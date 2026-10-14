import { createHash } from "node:crypto";
import type { Chunk } from "./types";
export type Page = { text: string; page: number | null };
export function cleanText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
// Conservative Unicode-aware token estimate. Arabic receives a larger budget per word.
export function tokenEstimate(s: string) {
  return Math.ceil(
    (s.match(/[\u0600-\u06ff]/g)?.length || 0) / 2 +
      s.replace(/[\u0600-\u06ff]/g, "").length / 4,
  );
}
export function chunkPages(
  pages: Page[],
  file: string,
  target = 500,
  overlap = 80,
): Omit<Chunk, "embedding">[] {
  const out: Omit<Chunk, "embedding">[] = [];
  let section = "Overview";
  for (const page of pages) {
    const paragraphs = cleanText(page.text).split(/\n\s*\n|\n(?=#{1,6}\s)/);
    let buffer = "";
    const flush = () => {
      if (!buffer.trim()) return;
      const text = buffer.trim();
      out.push({
        id: createHash("sha256")
          .update(`${file}:${page.page}:${out.length}:${text}`)
          .digest("hex")
          .slice(0, 20),
        file,
        page: page.page,
        section,
        text,
      });
    };
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;
      const heading = paragraph.match(/^#{1,6}\s+([^\n]+)/);
      if (heading) {
        flush();
        buffer = "";
        section = heading[1].trim();
      }
      const pieces: string[] = [];
      if (tokenEstimate(paragraph) > target) {
        let piece = "";
        for (const word of paragraph.split(/\s+/)) {
          if (tokenEstimate(piece + " " + word) > target && piece) {
            pieces.push(piece);
            piece = "";
          }
          if (tokenEstimate(word) > target) {
            if (piece) {
              pieces.push(piece);
              piece = "";
            }
            const size = Math.max(100, target * 2);
            for (let i = 0; i < word.length; i += size)
              pieces.push(word.slice(i, i + size));
          } else piece += (piece ? " " : "") + word;
        }
        if (piece) pieces.push(piece);
      } else pieces.push(paragraph);
      for (const piece of pieces) {
        if (buffer && tokenEstimate(buffer + "\n\n" + piece) > target) {
          flush();
          const words = buffer.split(/\s+/);
          let tail = "";
          for (let i = words.length - 1; i >= 0; i--) {
            const next = words[i] + (tail ? " " + tail : "");
            if (tokenEstimate(next) > overlap) break;
            tail = next;
          }
          buffer = tokenEstimate(tail + " " + piece) <= target ? tail : "";
        }
        buffer += (buffer ? "\n\n" : "") + piece;
      }
    }
    flush();
  }
  return out;
}
