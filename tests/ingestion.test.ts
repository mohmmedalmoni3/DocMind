import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";

// Small valid, uncompressed ZIP fixture; avoids another runtime dependency.
function docx(text: string) {
  const entries: Record<string, string> = {
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  };
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const n = Buffer.from(name),
      data = Buffer.from(value);
    let crc = 0xffffffff;
    for (const b of data) {
      crc ^= b;
      for (let k = 0; k < 8; k++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18);
    h.writeUInt32LE(data.length, 22);
    h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    local.push(h, n, data);
    central.push(c, n);
    offset += h.length + n.length + data.length;
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(3, 8);
  end.writeUInt16LE(3, 10);
  end.writeUInt32LE(Buffer.concat(central).length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
function pdf() {
  const stream = "BT /F1 12 Tf 50 750 Td (The launch is on November 18.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(content));
    content += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return content;
}
test("all four formats, hash cache, incremental replacement and deletion", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "docmind-test-"));
  const docs = path.join(root, "docs");
  await fs.mkdir(docs);
  let embedded = 0;
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const part of req) raw += part;
    const body = JSON.parse(raw);
    embedded += body.input.length;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({ embeddings: body.input.map(() => [1, 0.5, 0.25]) }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.DOCS_DIR = docs;
  process.env.INDEX_DIR = path.join(root, "data");
  process.env.OLLAMA_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    await fs.writeFile(
      path.join(docs, "a.txt"),
      "The budget is 48,000 dollars.",
    );
    await fs.writeFile(
      path.join(docs, "b.md"),
      "# Launch\n\nThe launch is November 18.",
    );
    await fs.writeFile(path.join(docs, "c.pdf"), pdf());
    await fs.writeFile(
      path.join(docs, "d.docx"),
      docx("The lead is Maya Chen."),
    );
    const { ingest } = await import("../lib/ingest");
    const events: unknown[] = [];
    const first = await ingest((e) => events.push(e));
    assert.equal(first.documents.length, 4, JSON.stringify(events));
    assert.ok(
      first.chunks.some(
        (c) =>
          c.file === "c.pdf" && c.page === 1 && c.text.includes("November"),
      ),
    );
    assert.ok(
      first.chunks.some((c) => c.file === "d.docx" && c.text.includes("Maya")),
    );
    const count = embedded;
    await ingest();
    assert.equal(embedded, count, "unchanged files must not call embedding");
    await fs.copyFile(path.join(docs, "a.txt"), path.join(docs, "copy.txt"));
    const copied = await ingest();
    assert.equal(
      embedded,
      count,
      "same content under a new filename reuses embeddings",
    );
    assert.equal(
      copied.chunks.find((c) => c.file === "copy.txt")?.text,
      copied.chunks.find((c) => c.file === "a.txt")?.text,
    );
    assert.notEqual(
      copied.chunks.find((c) => c.file === "copy.txt")?.id,
      copied.chunks.find((c) => c.file === "a.txt")?.id,
    );
    await fs.unlink(path.join(docs, "copy.txt"));
    await fs.writeFile(
      path.join(docs, "a.txt"),
      "The updated budget is 50,000 dollars.",
    );
    await fs.unlink(path.join(docs, "b.md"));
    const next = await ingest();
    assert.equal(next.documents.length, 3);
    assert.ok(!next.chunks.some((c) => c.file === "b.md"));
    assert.ok(next.chunks.some((c) => c.text.includes("50,000")));
    assert.equal(embedded, count + 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    await fs.rm(root, { recursive: true, force: true });
  }
});
