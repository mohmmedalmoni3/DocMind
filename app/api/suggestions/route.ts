import { readIndex } from "@/lib/index-store";
import { errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const index = await readIndex(),
      hashes = new Set<string>();
    const docs = index.documents.filter((d) => {
      if (hashes.has(d.hash)) return false;
      hashes.add(d.hash);
      return true;
    });
    const questions = docs.slice(0, 4).map((d) => {
      const title = d.name.replace(/\.[^.]+$/, "").replace(/^\d+[-_]/, "");
      const section = index.chunks
          .find((c) => c.file === d.name && c.section.length > 3)
          ?.section.replace(/^#+\s*/, "")
          .slice(0, 65),
        ar = /[\u0600-\u06ff]/.test(title);
      return section && section !== title
        ? ar
          ? `ماذا يذكر ${title} عن ${section}؟`
          : `What does ${title} say about ${section}?`
        : ar
          ? `ما أبرز المعلومات في ${title}؟`
          : `What are the key points in ${title}?`;
    });
    return Response.json({ questions, key: index.updatedAt });
  } catch (e) {
    return errorResponse(e, 500);
  }
}
