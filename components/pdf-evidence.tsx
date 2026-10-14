"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  X,
  ExternalLink,
} from "lucide-react";
import type { Source } from "@/lib/types";
import { evidenceItems } from "@/lib/pdf-evidence";
type Box = { left: number; top: number; width: number; height: number };
export default function PdfEvidence({
  source,
  onClose,
}: {
  source: Source;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const [page, setPage] = useState(source.page || 1),
    [pages, setPages] = useState(0),
    [boxes, setBoxes] = useState<Box[]>([]),
    [size, setSize] = useState({ width: 700, height: 990 }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [match, setMatch] = useState("");
  const url = `/api/source?file=${encodeURIComponent(source.file)}`;
  const documentRef = useRef<import("pdfjs-dist").PDFDocumentProxy>();
  useEffect(() => {
    setPage(source.page || 1);
  }, [source.id]);
  useEffect(() => {
    let cancelled = false,
      task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    setLoading(true);
    setError("");
    setPages(0);
    void import("pdfjs-dist")
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        task = pdfjs.getDocument({
          url,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
        });
        const doc = await task.promise;
        if (cancelled) return;
        documentRef.current = doc;
        setPages(doc.numPages);
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      documentRef.current = undefined;
      void task?.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!pages || !documentRef.current) return;
    let cancelled = false,
      render: import("pdfjs-dist").RenderTask | undefined;
    setLoading(true);
    setError("");
    setBoxes([]);
    void (async () => {
      const pdfjs = await import("pdfjs-dist"),
        pdfPage = await documentRef.current!.getPage(Math.min(page, pages)),
        viewport = pdfPage.getViewport({ scale: 1.3 }),
        text = await pdfPage.getTextContent();
      if (cancelled || !canvas.current) return;
      const target = canvas.current;
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      setSize({ width: viewport.width, height: viewport.height });
      render = pdfPage.render({ canvas: target, viewport });
      await render.promise;
      if (cancelled) return;
      const items = text.items.filter(
        (item): item is import("pdfjs-dist/types/src/display/api").TextItem =>
          "str" in item,
      );
      const result =
        page === (source.page || 1)
          ? evidenceItems(
              items.map((i) => i.str),
              source.text,
            )
          : { indices: [], exact: false };
      setBoxes(
        result.indices.map((i) => {
          const item = items[i],
            transform = pdfjs.Util.transform(
              viewport.transform,
              item.transform,
            ),
            height = Math.hypot(transform[2], transform[3]);
          return {
            left: transform[4],
            top: transform[5] - height,
            width: Math.max(item.width * viewport.scale, 2),
            height: height * 1.15,
          };
        }),
      );
      setMatch(
        page !== (source.page || 1)
          ? "أنت تتصفح صفحة أخرى؛ الدليل في الصفحة المشار إليها."
          : result.indices.length
            ? result.exact
              ? "تمت مطابقة المقطع مع النص الأصلي."
              : "أُبرزت الأجزاء المطابقة؛ راجع المقطع الكامل بجانب الصفحة."
            : "تعذرت المطابقة التلقائية؛ راجع الصفحة والمقطع المفهرس.",
      );
      setLoading(false);
    })().catch((e) => {
      if (!cancelled) {
        setError((e as Error).message);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [page, pages, source.id, source.text, source.page]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return (
    <div className="pdf-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialog}
        className="pdf-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Original PDF evidence"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key !== "Tab") return;
          const controls = Array.from(
            dialog.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),a[href]",
            ) || [],
          );
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <header>
          <div>
            <span className="eyebrow">
              SOURCE [{source.citation}] · ORIGINAL DOCUMENT
            </span>
            <h2 dir="auto">{source.file}</h2>
          </div>
          <button aria-label="Close PDF evidence" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="pdf-controls">
          <button
            aria-label="Previous PDF page"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            Page {page} / {pages || "…"}
          </span>
          <button
            aria-label="Next PDF page"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={17} />
          </button>
          <button onClick={() => setPage(source.page || 1)}>الدليل</button>
          <a href={`${url}#page=${page}`} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
            فتح الملف
          </a>
        </div>
        <div className="pdf-body">
          <div className="pdf-page-scroll">
            {loading && (
              <div className="pdf-loading">
                <LoaderCircle className="spin" size={20} /> جارٍ تحميل الصفحة
                محليًا…
              </div>
            )}
            {error && (
              <div role="alert" className="notice error">
                {error}
              </div>
            )}
            <div
              className="pdf-sheet"
              style={{ aspectRatio: `${size.width}/${size.height}` }}
            >
              <canvas ref={canvas} aria-label={`Original PDF page ${page}`} />
              <div
                className="pdf-highlights"
                aria-label="Matched source highlights"
              >
                {boxes.map((b, i) => (
                  <span
                    key={i}
                    style={{
                      left: `${(b.left / size.width) * 100}%`,
                      top: `${(b.top / size.height) * 100}%`,
                      width: `${(b.width / size.width) * 100}%`,
                      height: `${(b.height / size.height) * 100}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <aside>
            <h3>المقطع المستخدم في الإجابة</h3>
            <p className="pdf-match" dir="auto">
              {match}
            </p>
            <blockquote dir="auto">{source.text}</blockquote>
            <small>
              الإبراز يساعد على مراجعة الدليل؛ لا يثبت وحده صحة استنتاج النموذج.
            </small>
          </aside>
        </div>
      </section>
    </div>
  );
}
