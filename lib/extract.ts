import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import type { Page } from "./chunking";
export const extensions = new Set([".pdf", ".txt", ".md", ".docx"]);
export async function extract(file: string): Promise<Page[]> {
  const buffer = await fs.readFile(file);
  const ext = path.extname(file).toLowerCase();
  if (ext === ".pdf") {
    // Import the library entry directly: package root runs a debug fixture at import time.
    const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const pages: Page[] = [];
    // A fresh typed array avoids pooled Node Buffer offsets in PDF.js's worker transport.
    await pdf(new Uint8Array(buffer), {
      pagerender: async (page: {
        pageNumber: number;
        getTextContent: () => Promise<{
          items: { str: string; transform: number[] }[];
        }>;
      }) => {
        const content = await page.getTextContent();
        let text = "";
        let y: number | undefined;
        for (const item of content.items) {
          const nextY = item.transform[5];
          text +=
            (y !== undefined && Math.abs(nextY - y) > 3 ? "\n" : " ") +
            item.str;
          y = nextY;
        }
        pages.push({ text, page: page.pageNumber });
        return text;
      },
    });
    return pages.sort((a, b) => (a.page || 0) - (b.page || 0));
  }
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return [{ text: result.value, page: null }];
  }
  if (ext === ".txt" || ext === ".md")
    return [{ text: buffer.toString("utf8"), page: null }];
  throw new Error(`Unsupported document type: ${ext}`);
}
