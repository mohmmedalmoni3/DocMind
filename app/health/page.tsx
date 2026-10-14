"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Database,
  Layers3,
  LoaderCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Mic,
} from "lucide-react";
type Health = {
  ready: boolean;
  ollama: boolean;
  url: string;
  generation: string | null;
  configured: string;
  fallback: string;
  embedding: { name: string; ready: boolean };
  index: { documents: number; chunks: number; compatible: boolean };
  available: string[];
  error: string;
  voice?: {
    ready: boolean;
    transcribe: boolean;
    voices: { ar: boolean; en: boolean };
  };
};
export default function HealthPage() {
  const [health, setHealth] = useState<Health | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function check() {
    setLoading(true);
    try {
      const r = await fetch("/api/health");
      if (!r.ok) throw new Error("Unable to check system health.");
      setHealth(await r.json());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    check();
  }, []);
  return (
    <main className="utility-page">
      <Link href="/" className="back-link">
        <ArrowLeft size={14} />
        Back to workspace
      </Link>
      <div className="utility-eyebrow">
        <ShieldCheck size={16} />
        SYSTEM HEALTH
      </div>
      <div className="utility-head">
        <div>
          <h1>
            {health?.ready
              ? "Ready for your next insight."
              : "Let’s get everything connected."}
          </h1>
          <p className="utility-description">
            Your local intelligence stack, at a glance. No cloud services, no
            API keys, no documents leaving your device.
          </p>
        </div>
        <button className="primary-button" onClick={check} disabled={loading}>
          {loading ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Check again
        </button>
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="health-grid">
        {[
          {
            title: "Local speech · الصوت المحلي",
            ok: health?.voice?.ready,
            icon: Mic,
            detail: "Whisper + Piper · العربية / English",
            extra: health?.voice?.ready
              ? "Voice models installed. Microphone permission is controlled by your browser."
              : "Run npm run setup:voice once, then refresh.",
          },
          {
            title: "Ollama connection",
            ok: health?.ollama,
            icon: Server,
            detail: health?.url || "http://127.0.0.1:11434",
            extra: health?.error,
          },
          {
            title: "Generation model",
            ok: !!health?.generation,
            icon: Cpu,
            detail: health?.generation || health?.configured || "qwen2.5:3b",
            extra:
              health?.generation && health.generation !== health.configured
                ? "Fallback model is active."
                : "Local text generation",
          },
          {
            title: "Embedding model",
            ok: health?.embedding.ready,
            icon: Layers3,
            detail: health?.embedding.name || "nomic-embed-text",
            extra: "Use bge-m3 for stronger Arabic retrieval.",
          },
          {
            title: "Knowledge index",
            ok: !!health?.index.chunks && health.index.compatible,
            icon: Database,
            detail: `${health?.index.documents || 0} documents · ${health?.index.chunks || 0} passages`,
            extra: health?.index.compatible
              ? "Index configuration is compatible."
              : "Re-ingest after changing embedding settings.",
          },
        ].map((c) => (
          <section className="health-card" key={c.title}>
            <div>
              <c.icon size={23} />
              <span className={`status-pill ${!c.ok ? "warning" : ""}`}>
                {loading ? "CHECKING" : c.ok ? "READY" : "NEEDS ATTENTION"}
              </span>
            </div>
            <h3>{c.title}</h3>
            <p>{c.detail}</p>
            <p>{c.extra}</p>
          </section>
        ))}
      </div>
      {!health?.ready && (
        <>
          <h3>Get ready, locally</h3>
          <pre className="command-block">{`ollama serve\nollama pull ${health?.configured || "qwen2.5:3b"}\nollama pull ${health?.embedding.name || "nomic-embed-text"}\nnpm run ingest`}</pre>
        </>
      )}
      <p className="utility-note">
        Model downloads need internet once. After that, DocMind uses only your
        local Ollama and speech engines. A ready status checks installed model
        names and index compatibility; the first answer warms the model.
      </p>
    </main>
  );
}
