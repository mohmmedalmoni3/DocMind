"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export default function Markdown({
  text,
  onCitation,
}: {
  text: string;
  onCitation?: (n: number) => void;
}) {
  const linked = text.replace(/\[(\d+)\](?!\()/g, "[[$1]](#source-$1)");
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => (
          <div
            className="markdown-table-scroll"
            role="region"
            aria-label="Table of document evidence"
            tabIndex={0}
          >
            <table>{children}</table>
            <span className="table-hint">
              اسحب الجدول أفقيًا لرؤية بقية الأعمدة
            </span>
          </div>
        ),
        a: ({ href, children }) =>
          href?.startsWith("#source-") && onCitation ? (
            <button
              className="inline-cite"
              onClick={() => onCitation?.(Number(href.slice(8)))}
            >
              {children}
            </button>
          ) : (
            <span>{children}</span>
          ),
        img: ({ alt }) => <span>{alt}</span>,
      }}
    >
      {linked}
    </ReactMarkdown>
  );
}
