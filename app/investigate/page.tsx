"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ShieldCheck,
  FileDiff,
  Search,
  Download,
  LoaderCircle,
  FileText,
  RefreshCw,
  ArrowLeftRight,
} from "lucide-react";
import type { DocumentRecord, Source } from "@/lib/types";
import type { Finding, EvidenceFact } from "@/lib/investigation";
import type { PassageVersion, VersionReport } from "@/lib/version-diff";
import { displayName, isArabic } from "@/lib/client";
const PdfEvidence = dynamic(() => import("@/components/pdf-evidence"), {
  ssr: false,
});
type Report = {
  builtAt: string;
  files: string[];
  factCount: number;
  limits: string;
  findings: (Omit<Finding, "facts"> & {
    facts: (EvidenceFact & { source: Source })[];
  })[];
};
const kindNames = {
  "potential-conflict": "تعارض محتمل",
  "revision-review": "مراجعة إصدار",
  "scope-review": "مراجعة الفترة والنطاق",
};
const changeNames = { added: "أُضيف", removed: "حُذف", changed: "تغيّر" };
function displayValue(value: string) {
  if (/^\$\d+(?:\.\d+)?$/.test(value))
    return `$${Number(value.slice(1)).toLocaleString("en-US")}`;
  return value.replace(/\bday$/, "أيام").replace(/\bhour$/, "ساعات");
}
export default function Investigation() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [mode, setMode] = useState<"scan" | "versions">("scan");
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [versions, setVersions] = useState<VersionReport | null>(null);
  const [pdf, setPdf] = useState<Source | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ms, setMs] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const closePdf = useCallback(() => setPdf(null), []);
  useEffect(() => {
    const abort = new AbortController();
    const theme = localStorage.getItem("docmind-theme");
    document.documentElement.dataset.theme =
      theme === "light" ? "light" : "dark";
    fetch("/api/documents", { signal: abort.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        const records: DocumentRecord[] = body.documents;
        setDocuments(records);
        let attachments: string[] = [];
        try {
          const stored: unknown = JSON.parse(
            localStorage.getItem("docmind-chat-files") || "[]",
          );
          if (Array.isArray(stored))
            attachments = stored.filter(
              (name): name is string => typeof name === "string",
            );
        } catch {
          /* A corrupt optional attachment preference does not hide library documents. */
        }
        const valid = attachments.filter((file) =>
          records.some((record) => record.name === file),
        );
        setSaved(valid);
        const files = attachments.length
          ? valid
          : records.slice(0, 100).map((d) => d.name);
        setSelected(files);
        setBefore(files[0] || "");
        setAfter(files[1] || "");
        if (attachments.length !== valid.length)
          setError(
            "بعض مرفقات المحادثة لم تعد مفهرسة. اختر الملفات المتاحة للفحص.",
          );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  function selection(files: string[]) {
    setSelected(files);
    setReport(null);
    setVersions(null);
    setMs(null);
    setError("");
    const nextBefore = files.includes(before) ? before : files[0] || "";
    setBefore(nextBefore);
    setAfter(
      files.includes(after) && after !== nextBefore
        ? after
        : files.find((file) => file !== nextBefore) || "",
    );
  }
  async function run() {
    if (busy || !selected.length) return;
    if (mode === "versions" && (!before || !after || before === after)) {
      setError("اختر ملفين مختلفين وحدد النسخة السابقة واللاحقة بنفسك.");
      return;
    }
    setBusy(true);
    setError("");
    setReport(null);
    setVersions(null);
    setMs(null);
    const start = performance.now();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch(
        mode === "scan" ? "/api/investigate" : "/api/versions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: selected, before, after }),
          signal: abort.signal,
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذّر إكمال الفحص.");
      if (mode === "scan") setReport(body);
      else setVersions(body);
      setMs(Math.round(performance.now() - start));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  function exportReport() {
    const content = JSON.stringify(
      {
        kind: mode,
        exportedAt: new Date().toISOString(),
        ms,
        report: mode === "scan" ? report : versions,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `DocMind-${mode}-report.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function passage(
    row: PassageVersion,
    words?: { text: string; changed: boolean }[],
    side?: "before" | "after",
  ) {
    return (
      <div className={`version-passage ${side || ""}`}>
        <small>
          {row.file}
          {row.page ? ` · ص ${row.page}` : ""} · {row.section}
        </small>
        <p dir={isArabic(row.text) ? "rtl" : "ltr"}>
          {words
            ? words.map((word, i) =>
                word.changed ? (
                  <mark key={i}>{word.text}</mark>
                ) : (
                  <span key={i}>{word.text}</span>
                ),
              )
            : row.text}
        </p>
        {row.source && (
          <details className="full-evidence">
            <summary>المقطع الأصلي</summary>
            <blockquote dir={isArabic(row.source.text) ? "rtl" : "ltr"}>
              {row.source.text}
            </blockquote>
          </details>
        )}
        {row.source && row.file.toLowerCase().endsWith(".pdf") && (
          <button
            className="evidence-link"
            onClick={() => setPdf({ ...row.source!, text: row.text })}
          >
            عرض الصفحة في PDF <FileText size={13} />
          </button>
        )}
      </div>
    );
  }
  return (
    <main className="utility-page investigation-page" dir="rtl">
      <Link className="back-link" href="/">
        <ArrowRight size={15} /> العودة للمحادثة
      </Link>
      <div className="utility-eyebrow">
        <ShieldCheck size={16} /> DOCUMENT INTELLIGENCE · LOCAL
      </div>
      <div className="utility-head">
        <div>
          <h1>الاختلاف الذي يستحق انتباهك.</h1>
          <p className="utility-description">
            أدلة واضحة من ملفاتك. افحص القيم المتباينة أو قارن نسختين، دون
            انتظار توليد إجابة.
          </p>
        </div>
        <span className="investigation-local">
          <ShieldCheck size={15} /> معالجة محلية · بدون استدعاء نموذج
        </span>
      </div>
      <div className="investigation-tabs" role="group" aria-label="نوع الفحص">
        <button
          disabled={busy}
          aria-pressed={mode === "scan"}
          onClick={() => {
            setMode("scan");
            setError("");
          }}
        >
          <Search size={16} /> محقق المستندات
        </button>
        <button
          disabled={busy}
          aria-pressed={mode === "versions"}
          onClick={() => {
            setMode("versions");
            setError("");
          }}
        >
          <FileDiff size={16} /> ما الذي تغيّر؟
        </button>
      </div>
      <section className="investigation-selection">
        <div className="investigation-selection-head">
          <strong>ملفات الفحص ({selected.length})</strong>
          <button
            disabled={busy || loading}
            onClick={() =>
              selection(documents.slice(0, 100).map((d) => d.name))
            }
          >
            المكتبة كاملة
          </button>
          <button
            disabled={busy || !saved.length}
            onClick={() => selection(saved)}
          >
            مرفقات المحادثة
          </button>
          <button disabled={busy} onClick={() => selection([])}>
            إلغاء التحديد
          </button>
        </div>
        {loading ? (
          <p>
            <LoaderCircle className="spin" size={15} /> تحميل الملفات…
          </p>
        ) : !documents.length ? (
          <p>أضف ملفات وفهرسها من المحادثة أولًا.</p>
        ) : (
          <div className="investigation-file-list">
            {documents.map((document) => (
              <label key={document.name} title={document.name}>
                <input
                  type="checkbox"
                  checked={selected.includes(document.name)}
                  disabled={
                    busy ||
                    (!selected.includes(document.name) &&
                      selected.length >= 100)
                  }
                  onChange={() =>
                    selection(
                      selected.includes(document.name)
                        ? selected.filter((file) => file !== document.name)
                        : [...selected, document.name],
                    )
                  }
                />
                <FileText size={14} />
                <span>{displayName(document.name)}</span>
              </label>
            ))}
          </div>
        )}
      </section>
      {mode === "versions" && (
        <div className="version-selectors">
          <label>
            النسخة السابقة
            <select
              aria-label="النسخة السابقة"
              disabled={busy}
              value={before}
              onChange={(e) => {
                setBefore(e.target.value);
                setVersions(null);
                setMs(null);
              }}
            >
              <option value="">اختر ملفًا</option>
              {selected.map((file) => (
                <option key={file}>{file}</option>
              ))}
            </select>
          </label>
          <button
            title="عكس ترتيب النسختين"
            aria-label="عكس ترتيب النسختين"
            disabled={busy}
            onClick={() => {
              setBefore(after);
              setAfter(before);
              setVersions(null);
              setMs(null);
            }}
          >
            <ArrowLeftRight size={18} />
          </button>
          <label>
            النسخة اللاحقة
            <select
              aria-label="النسخة اللاحقة"
              disabled={busy}
              value={after}
              onChange={(e) => {
                setAfter(e.target.value);
                setVersions(null);
                setMs(null);
              }}
            >
              <option value="">اختر ملفًا</option>
              {selected.map((file) => (
                <option key={file}>{file}</option>
              ))}
            </select>
          </label>
          <small>
            الترتيب من اختيارك؛ اسم الملف لا يثبت تاريخ الإصدار أو اعتماد
            النسخة.
          </small>
        </div>
      )}
      <div className="investigation-actions">
        <button
          className="primary-button"
          disabled={
            busy ||
            loading ||
            !selected.length ||
            (mode === "versions" && selected.length < 2)
          }
          onClick={run}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Search size={16} />
          )}
          {mode === "scan" ? "افحص الملفات" : "قارن النسختين"}
        </button>
        {ms !== null && <span role="status">اكتمل الفحص في {ms} ms</span>}
        {(mode === "scan" ? report : versions) && (
          <button className="export-investigation" onClick={exportReport}>
            <Download size={15} /> تصدير التقرير
          </button>
        )}
      </div>
      {error && (
        <div className="investigation-error" role="alert">
          {error}
          <Link href="/">
            {" "}
            <RefreshCw size={13} /> العودة لفهرسة الملفات
          </Link>
        </div>
      )}
      {mode === "scan" && report && (
        <>
          <div className="investigation-metrics">
            <div>
              <strong>{report.findings.length}</strong>
              <span>اختلاف يستحق المراجعة</span>
            </div>
            <div>
              <strong>{report.factCount}</strong>
              <span>حقيقة صريحة مفحوصة</span>
            </div>
            <div>
              <strong>{report.files.length}</strong>
              <span>ملف ضمن الفحص</span>
            </div>
          </div>
          <p className="investigation-limit">
            {report.limits}
            <br />
            الأدلة مجهزة عند الفهرسة:{" "}
            {new Date(report.builtAt).toLocaleString("ar-JO")}
          </p>
          {!report.findings.length && (
            <div className="investigation-empty">
              <ShieldCheck size={28} />
              <h2>لم يظهر اختلاف ضمن الحقائق المفحوصة.</h2>
              <p>
                هذا لا يثبت خلو المستندات من التعارضات. يمكنك مقارنة نسختين
                نصيًا.
              </p>
            </div>
          )}
          {report.findings.map((finding) => (
            <article
              className={`finding-card ${finding.kind}`}
              key={finding.id}
            >
              <header>
                <span className="finding-kind">{kindNames[finding.kind]}</span>
                <h2>
                  {finding.field} · {finding.entity}
                </h2>
              </header>
              <p>{finding.explanation}</p>
              <div className="finding-evidence">
                {finding.facts.map((fact) => (
                  <section key={fact.id}>
                    <strong dir="auto">{displayValue(fact.value)}</strong>
                    <small>
                      {displayName(fact.file)}
                      {fact.page ? ` · ص ${fact.page}` : ""}
                    </small>
                    <blockquote dir={isArabic(fact.quote) ? "rtl" : "ltr"}>
                      {fact.quote}
                    </blockquote>
                    <span className="fact-period">
                      الفترة: {fact.period || "غير محددة"} · النطاق:{" "}
                      {fact.scope || "غير محدد"}
                    </span>
                    <details className="full-evidence">
                      <summary>المقطع الأصلي كاملًا</summary>
                      <p dir={isArabic(fact.source.text) ? "rtl" : "ltr"}>
                        {fact.source.text}
                      </p>
                    </details>
                    {fact.file.toLowerCase().endsWith(".pdf") && (
                      <button
                        className="evidence-link"
                        onClick={() =>
                          setPdf({ ...fact.source, text: fact.quote })
                        }
                      >
                        عرض صفحة الدليل <FileText size={13} />
                      </button>
                    )}
                  </section>
                ))}
              </div>
            </article>
          ))}
        </>
      )}
      {mode === "versions" && versions && (
        <>
          <div className="investigation-metrics">
            <div>
              <strong>{versions.counts.changed}</strong>
              <span>مقطع تغيّر</span>
            </div>
            <div>
              <strong>{versions.counts.added}</strong>
              <span>مقطع أُضيف</span>
            </div>
            <div>
              <strong>{versions.counts.removed}</strong>
              <span>مقطع حُذف</span>
            </div>
          </div>
          <p className="investigation-limit">
            مقارنة النص المفهرس، بعد توحيد المسافات وبعض أشكال الأحرف والأرقام.
            لا تفحص الصور أو تنسيق الصفحات؛ تطابق المقاطع لا يعني تطابق
            الوثيقتين كاملًا. المقاطع المتشابهة تُحاذى تقريبيًا.{" "}
            {versions.unchanged} مقطعًا متطابقًا.
            {versions.truncated
              ? " التقرير محدود؛ قد توجد تغييرات إضافية في الملفات الطويلة."
              : ""}
          </p>
          {versions.sameContent && (
            <div className="investigation-empty">
              الملفان متطابقان في المحتوى الأصلي بحسب بصمة الملف.
            </div>
          )}
          {!versions.changes.length && !versions.sameContent && (
            <div className="investigation-empty">
              لم تظهر تغييرات في المقاطع النصية المقارنة.
            </div>
          )}
          {versions.changes.map((change, i) => (
            <article className={`version-change ${change.kind}`} key={i}>
              <header>
                <span>{changeNames[change.kind]}</span>
                <small>
                  التمييز يوضح الفرق النصي، دون استنتاج أثر قانوني أو عملي.
                </small>
              </header>
              <div className="version-columns">
                {change.before ? (
                  passage(change.before, change.beforeWords, "before")
                ) : (
                  <div className="version-placeholder">
                    غير موجود في النسخة السابقة
                  </div>
                )}
                {change.after ? (
                  passage(change.after, change.afterWords, "after")
                ) : (
                  <div className="version-placeholder">
                    غير موجود في النسخة اللاحقة
                  </div>
                )}
              </div>
            </article>
          ))}
        </>
      )}
      {!report && !versions && !error && !busy && (
        <div className="investigation-empty">
          <FileDiff size={32} />
          <h2>المصدر أولًا. الاستنتاج بعده.</h2>
          <p>
            اختر الملفات وابدأ الفحص. يمكنك رفع نسختين من المحادثة ثم مقارنتهما
            هنا.
          </p>
        </div>
      )}
      {pdf && <PdfEvidence source={pdf} onClose={closePdf} />}
    </main>
  );
}
