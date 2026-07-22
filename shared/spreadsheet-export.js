/*
 * Dependency-free spreadsheet export: CSV (trivial) and a genuine .xlsx
 * (minimal OOXML written directly, zipped with a hand-rolled "store"-method
 * ZIP writer). No CDN, no build step, works fully offline — the point is
 * that these calculators stay single-file-openable, so pulling in a
 * third-party xlsx library wasn't an option.
 *
 * API:
 *   SharedExport.toCSV(headers, rows) -> string
 *   SharedExport.downloadCSV(filename, headers, rows)
 *   SharedExport.downloadXLSX(filename, sheetName, headers, rows)
 *   rows: array of arrays, cell values are numbers or strings.
 */
(function (global) {
  "use strict";

  // ---------- CSV ----------
  function csvEscape(v) {
    const s = v === null || v === undefined ? "" : String(v);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function toCSV(headers, rows) {
    const lines = [headers.map(csvEscape).join(",")];
    for (const row of rows) lines.push(row.map(csvEscape).join(","));
    return lines.join("\r\n");
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadCSV(filename, headers, rows) {
    const csv = toCSV(headers, rows);
    downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  }

  // ---------- minimal ZIP (store method, no compression) ----------
  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function strToBytes(str) {
    return new TextEncoder().encode(str);
  }

  // files: array of { name: string, data: Uint8Array }
  function buildZip(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = strToBytes(file.name);
      const data = file.data;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);   // version needed
      local.setUint16(6, 0, true);    // flags
      local.setUint16(8, 0, true);    // method: stored
      local.setUint16(10, 0, true);   // mod time
      local.setUint16(12, 0x21, true); // mod date (arbitrary valid date)
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true); // compressed size
      local.setUint32(22, data.length, true); // uncompressed size
      local.setUint16(26, nameBytes.length, true);
      local.setUint16(28, 0, true);   // extra field length

      const localHeaderBytes = new Uint8Array(local.buffer);
      localParts.push(localHeaderBytes, nameBytes, data);

      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true);
      central.setUint16(4, 20, true);  // version made by
      central.setUint16(6, 20, true);  // version needed
      central.setUint16(8, 0, true);   // flags
      central.setUint16(10, 0, true);  // method
      central.setUint16(12, 0, true);  // mod time
      central.setUint16(14, 0x21, true); // mod date
      central.setUint32(16, crc, true);
      central.setUint32(20, data.length, true);
      central.setUint32(24, data.length, true);
      central.setUint16(28, nameBytes.length, true);
      central.setUint16(30, 0, true); // extra length
      central.setUint16(32, 0, true); // comment length
      central.setUint16(34, 0, true); // disk number start
      central.setUint16(36, 0, true); // internal attrs
      central.setUint32(38, 0, true); // external attrs
      central.setUint32(42, offset, true); // offset of local header

      centralParts.push(new Uint8Array(central.buffer), nameBytes);

      offset += localHeaderBytes.length + nameBytes.length + data.length;
    }

    const centralOffset = offset;
    let centralSize = 0;
    for (const p of centralParts) centralSize += p.length;

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(4, 0, true);
    end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, centralOffset, true);
    end.setUint16(20, 0, true);

    const allParts = [...localParts, ...centralParts, new Uint8Array(end.buffer)];
    let total = 0;
    for (const p of allParts) total += p.length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of allParts) { out.set(p, pos); pos += p.length; }
    return out;
  }

  // ---------- minimal OOXML (.xlsx) ----------
  // Drop characters not legal in XML 1.0 text content (keep tab/LF/CR, drop
  // other C0 controls) without embedding raw control bytes in this source file.
  function stripIllegalXmlChars(s) {
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      if (code === 9 || code === 10 || code === 13 || code >= 32) out += s[i];
    }
    return out;
  }

  function escapeXml(s) {
    const clean = stripIllegalXmlChars(String(s));
    return clean
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function colName(index) {
    let n = index, name = "";
    do {
      name = String.fromCharCode(65 + (n % 26)) + name;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return name;
  }

  function buildSheetXml(headers, rows) {
    const allRows = [headers, ...rows];
    const rowXml = allRows.map((row, ri) => {
      const r = ri + 1;
      const cells = row.map((val, ci) => {
        const ref = colName(ci) + r;
        if (typeof val === "number" && isFinite(val)) {
          return `<c r="${ref}"><v>${val}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(val)}</t></is></c>`;
      }).join("");
      return `<row r="${r}">${cells}</row>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetData>${rowXml}</sheetData></worksheet>`;
  }

  const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const RELS_ROOT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  function workbookXml(sheetName) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
  }

  const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
</styleSheet>`;

  function buildXLSXBytes(sheetName, headers, rows) {
    const files = [
      { name: "[Content_Types].xml", data: strToBytes(CONTENT_TYPES) },
      { name: "_rels/.rels", data: strToBytes(RELS_ROOT) },
      { name: "xl/workbook.xml", data: strToBytes(workbookXml(sheetName)) },
      { name: "xl/_rels/workbook.xml.rels", data: strToBytes(WORKBOOK_RELS) },
      { name: "xl/styles.xml", data: strToBytes(STYLES_XML) },
      { name: "xl/worksheets/sheet1.xml", data: strToBytes(buildSheetXml(headers, rows)) }
    ];
    return buildZip(files);
  }

  function downloadXLSX(filename, sheetName, headers, rows) {
    const bytes = buildXLSXBytes(sheetName, headers, rows);
    downloadBlob(filename, new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }));
  }

  global.SharedExport = { toCSV, downloadCSV, buildXLSXBytes, downloadXLSX, downloadBlob };
})(typeof window !== "undefined" ? window : globalThis);
