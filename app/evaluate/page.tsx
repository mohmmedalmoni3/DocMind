"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  FlaskConical,
  LoaderCircle,
  Play,
  Square,
  X,
  Download,
} from "lucide-react";
import { evaluationCases } from "@/lib/evaluation";
import { consume } from "@/lib/client";
import Markdown from "@/components/markdown";
type Result = {
  type: "result";
  question: string;
  expected: string;
  answer: string;
  pass: boolean;
  correct: boolean;
  citation: boolean;
  ms: number;
  firstTokenMs?: number;
  category?: string;
  method?: "extractive" | "generated";
};
type Event =
  | Result
  | { type: "progress"; current: number; total: number; question: string }
  | { type: "complete"; passed: number; total: number; score: number }
  | { type: "error"; message: string };
export default function Evaluation() {
  const [results, setResults] = useState<Result[]>([]),
    [busy, setBusy] = useState(false),
    [current, setCurrent] = useState(-1),
    [score, setScore] = useState<number | null>(null),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const runStarted = useRef(false);
  const [recorded, setRecorded] = useState<{
    at: string;
    stale: boolean;
    model: string;
    documents: number;
  } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/evaluate", { signal: abort.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.available && !runStarted.current) {
          setResults(d.results);
          setScore(d.score);
          setRecorded({
            at: d.at,
            stale: d.stale,
            model: d.model,
            documents: d.documents,
          });
        }
      })
      .catch(() => {});
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const median = times.length
    ? times[Math.floor(times.length / 2)] / 1000
    : null;
  const p95 = times.length
    ? times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)] /
      1000
    : null;
  function exportResults() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            at: recorded?.at || new Date().toISOString(),
            recordedRun: recorded,
            score,
            complete: results.length === evaluationCases.length,
            cacheBypassed: true,
            medianMs: median === null ? null : median * 1000,
            p95Ms: p95 === null ? null : p95 * 1000,
            results,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "DocMind-quality-report.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function run() {
    runStarted.current = true;
    setBusy(true);
    setRecorded(null);
    setResults([]);
    setScore(null);
    setError("");
    controller.current = new AbortController();
    try {
      await consume<Event>(
        await fetch("/api/evaluate", {
          method: "POST",
          signal: controller.current.signal,
        }),
        (e) => {
          if (e.type === "result") setResults((r) => [...r, e]);
          if (e.type === "progress") setCurrent(e.current);
          if (e.type === "complete") setScore(e.score);
          if (e.type === "error") throw new Error(e.message);
        },
      );
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "Evaluation stopped. Partial results are shown."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
      setCurrent(-1);
    }
  }
  return (
    <main className="utility-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={14} />
        Back to workspace
      </Link>
      <div className="utility-eyebrow">
        <FlaskConical size={16} />
        QUALITY LAB
      </div>
      {recorded && (
        <p className="recorded-note" role="status">
          Recorded local run · {new Date(recorded.at).toLocaleString()} ·{" "}
          {recorded.model} · {recorded.documents} documents.{" "}
          {recorded.stale
            ? "The library has changed; rerun to measure the current documents."
            : "Matches the current library revision."}{" "}
          Use Run evaluation for a fresh measurement.
        </p>
      )}
      <div className="utility-head">
        <div>
          <h1>Good answers. Real evidence.</h1>
          <p className="utility-description">
            A small, transparent benchmark against the included Atlas demo
            documents. English, Arabic, citations, and knowing when to say “I
            don’t know.” Includes document scope, follow-up references and
            comparison. Answer reuse is disabled during evaluation.
          </p>
        </div>
        {busy ? (
          <button
            className="primary-button"
            onClick={() => controller.current?.abort()}
          >
            <Square size={15} />
            Stop evaluation
          </button>
        ) : (
          <button className="primary-button" onClick={run}>
            <Play size={15} />
            Run evaluation
          </button>
        )}
      </div>
      <div className="quality-summary">
        <span>
          Facts: {results.filter((r) => r.correct).length}/
          {results.length || "—"}
        </span>
        <span>
          Sources: {results.filter((r) => r.citation).length}/
          {results.length || "—"}
        </span>
        <span>Median: {median === null ? "—" : `${median.toFixed(1)}s`}</span>
        <span>Observed P95: {p95 === null ? "—" : `${p95.toFixed(1)}s`}</span>
        <button disabled={!results.length || busy} onClick={exportResults}>
          <Download size={14} />
          Export report
        </button>
      </div>
      <div className="eval-metrics">
        <div className="eval-metric">
          <strong>{score === null ? "—" : `${score}%`}</strong>
          <span>Answer + citation checks passed</span>
        </div>
        <div className="eval-metric">
          <strong>
            {results.length} / {evaluationCases.length}
          </strong>
          <span>Questions evaluated</span>
        </div>
        <div className="eval-metric">
          <strong>
            {results.length
              ? `${(results.reduce((a, r) => a + r.ms, 0) / results.length / 1000).toFixed(1)}s`
              : "—"}
          </strong>
          <span>Average response time</span>
        </div>
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {evaluationCases.map((c, i) => {
        const r = results.find((r) => r.question === c.question);
        return (
          <section className="eval-case" key={c.question}>
            <div className="eval-case-head">
              <span>{String(i + 1).padStart(2, "0")}</span>
              <h3 dir="auto">{c.question}</h3>
              {busy && current === i ? (
                <LoaderCircle className="spin" size={16} />
              ) : r ? (
                <span className={`status-pill ${r.pass ? "" : "warning"}`}>
                  {r.pass ? "PASS" : "REVIEW"}
                </span>
              ) : (
                <span className="status-pill warning">NOT RUN</span>
              )}
            </div>
            <p>
              {c.category || "Fact"} · Expected:{" "}
              <span dir="auto">{c.expected}</span>
            </p>
            {r && (
              <div className="eval-answer">
                <div className="markdown" dir="auto">
                  <Markdown text={r.answer} />
                </div>
                <small>
                  Answer match: {r.correct ? "pass" : "review"} · Source
                  citation: {r.citation ? "pass" : "review"} ·{" "}
                  {(r.ms / 1000).toFixed(1)}s
                  {r.method === "extractive"
                    ? " · Direct document evidence"
                    : " · Model generation"}
                  {r.firstTokenMs !== undefined
                    ? ` · First text ${(r.firstTokenMs / 1000).toFixed(1)}s`
                    : ""}
                </small>
              </div>
            )}
          </section>
        );
      })}
      <p className="utility-note">
        Scoring is deterministic: required answer terms must appear, and the
        expected document must be cited, and numeric literals must occur in
        their cited passage. Abstention must contain the expected refusal and no
        citations. The comparison case requires citations from both files; role
        differences still need human interpretation. This{" "}
        {evaluationCases.length}-question demo benchmark is not a general
        accuracy estimate. Replace the fixtures in lib/evaluation.ts to evaluate
        your own corpus.
      </p>
    </main>
  );
}
