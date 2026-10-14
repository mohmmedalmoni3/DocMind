"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AudioLines,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Command,
  Download,
  FileText,
  FlaskConical,
  FolderOpen,
  GitCompareArrows,
  Globe2,
  Layers3,
  LoaderCircle,
  Menu,
  MessageSquare,
  Mic,
  Minus,
  MoreHorizontal,
  PanelRightClose,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Moon,
  Upload,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type {
  DocumentRecord,
  IngestEvent,
  RagEvent,
  Source,
  Step,
  ChatTurn,
  AnswerStyle,
} from "@/lib/types";
import { consume, displayName, isArabic } from "@/lib/client";
import Markdown from "./markdown";
import { useLocalVoice } from "@/lib/use-local-voice";
const PdfEvidence = dynamic(() => import("./pdf-evidence"), { ssr: false });
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  steps: Step[];
  confidence?: string;
  ms?: number;
  cached?: boolean;
  firstTokenMs?: number;
  model?: string;
  grounded?: boolean;
  file?: string;
  error?: string;
  style?: AnswerStyle;
  compared?: boolean;
  method?: "extractive" | "generated";
  evidenceMs?: number;
};
type Library = {
  documents: DocumentRecord[];
  chunks: number;
  model: string;
  embedding: string;
  stale: boolean;
  maxUpload: number;
};
type Health = {
  ready: boolean;
  ollama: boolean;
  generation: string | null;
  error: string;
};
const empty: Library = {
  documents: [],
  chunks: 0,
  model: "qwen2.5:3b",
  embedding: "nomic-embed-text",
  stale: false,
  maxUpload: 20 * 1024 * 1024,
};
const pipeline = ["Rewriting query", "Searching", "Ranking", "Generating"];
const iconFor = [Braces, Search, Layers3, Sparkles];
export default function Workspace() {
  const [library, setLibrary] = useState<Library>(empty),
    [health, setHealth] = useState<Health | null>(null),
    [loaded, setLoaded] = useState(false),
    [messages, setMessages] = useState<Message[]>([]),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [suggestions, setSuggestions] = useState<string[]>([]),
    [progress, setProgress] = useState<IngestEvent | null>(null),
    [indexing, setIndexing] = useState(false),
    [drag, setDrag] = useState(false),
    [dark, setDark] = useState(true),
    [sidebar, setSidebar] = useState(false),
    [inspector, setInspector] = useState(true),
    [mobileInspector, setMobileInspector] = useState(false),
    [source, setSource] = useState<Source | null>(null),
    [scope, setScope] = useState(""),
    [compare, setCompare] = useState(false),
    [second, setSecond] = useState(""),
    [filter, setFilter] = useState("");
  const voice = useLocalVoice(setQuestion, setNotice);
  const [style, setStyle] = useState<AnswerStyle>("brief");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachmentsRestored, setAttachmentsRestored] = useState(false);
  const conversationDocuments = attachments.length
    ? library.documents.filter((d) => attachments.includes(d.name))
    : library.documents;
  function toggleAttachment(name: string) {
    if (busy || indexing || preparingDemo) return;
    setAttachments((current) =>
      current.includes(name)
        ? current.filter((file) => file !== name)
        : current.length < 100
          ? [...current, name]
          : current,
    );
    setScope("");
    setCompare(false);
  }
  const [pdfSource, setPdfSource] = useState<Source | null>(null);
  const closePdf = useCallback(() => setPdfSource(null), []);
  const [preparingDemo, setPreparingDemo] = useState(false);
  const [preparedDemo, setPreparedDemo] = useState(false);
  const warmAbort = useRef<AbortController | null>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLTextAreaElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    bottom = useRef<HTMLDivElement>(null),
    inspectorPanel = useRef<HTMLElement>(null),
    abort = useRef<AbortController | null>(null),
    suggestionAbort = useRef<AbortController | null>(null),
    messageRef = useRef<Message[]>([]);
  useEffect(() => {
    messageRef.current = messages;
  }, [messages]);
  const refresh = useCallback(async () => {
    try {
      const [l, h] = await Promise.all([
        fetch("/api/documents").then((r) => r.json()),
        fetch("/api/health").then((r) => r.json()),
      ]);
      if (l.error) throw new Error(l.error);
      setLibrary(l);
      setHealth(h);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);
  const loadSuggestions = useCallback(() => {
    suggestionAbort.current?.abort();
    suggestionAbort.current = new AbortController();
    fetch("/api/suggestions", { signal: suggestionAbort.current.signal })
      .then((r) => r.json())
      .then((d) => setSuggestions(d.questions || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    loadSuggestions();
    try {
      const stored = localStorage.getItem("docmind-chat");
      if (stored) setMessages(JSON.parse(stored));
      const savedAttachments = JSON.parse(
        localStorage.getItem("docmind-chat-files") || "[]",
      );
      if (
        Array.isArray(savedAttachments) &&
        savedAttachments.every((name) => typeof name === "string")
      )
        setAttachments([...new Set<string>(savedAttachments)].slice(0, 100));
      const theme = localStorage.getItem("docmind-theme");
      if (theme === "light") setDark(false);
    } catch {
      setNotice("Saved conversation could not be restored.");
    }
    setAttachmentsRestored(true);
    return () => {
      abort.current?.abort();
      suggestionAbort.current?.abort();
      warmAbort.current?.abort();
    };
  }, [refresh, loadSuggestions]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("docmind-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (loaded && !busy)
      try {
        localStorage.setItem("docmind-chat", JSON.stringify(messages));
      } catch {
        setNotice(
          "Browser storage is full. Export this conversation to keep a copy.",
        );
      }
  }, [messages, loaded, busy]);
  useEffect(() => {
    if (attachmentsRestored) {
      try {
        localStorage.setItem("docmind-chat-files", JSON.stringify(attachments));
      } catch {
        setNotice("تعذّر حفظ ملفات المحادثة في المتصفح.");
      }
    }
  }, [attachments, attachmentsRestored]);
  useEffect(() => {
    if (bottom.current?.parentElement) {
      const area = bottom.current.parentElement;
      area.scrollTop = messages.length ? area.scrollHeight : 0;
    }
  }, [messages, busy]);
  useEffect(() => {
    if (inspectorPanel.current) inspectorPanel.current.scrollTop = 0;
  }, [source?.id, messages.length === 0]);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        input.current?.focus();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "o"
      ) {
        e.preventDefault();
        if (!busy && !indexing && !preparingDemo) {
          setMessages([]);
          setSource(null);
          setAttachments([]);
          setScope("");
          setCompare(false);
        }
      }
      if (e.key === "Escape") {
        voice.cancelInput();
        if (busy) abort.current?.abort();
        setSource(null);
        setSidebar(false);
        setMobileInspector(false);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [busy, indexing, preparingDemo]);
  const update = (id: string, fn: (m: Message) => Message) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));
  async function runAnswer(
    q: string,
    history: ChatTurn[],
    file?: string,
    summary = false,
    compareFiles?: [string, string],
  ) {
    const id = crypto.randomUUID();
    setMessages((ms) => [
      ...ms,
      {
        id,
        role: "assistant",
        content: "",
        sources: [],
        steps: [],
        file,
        style: summary ? "brief" : style,
        compared: !!compareFiles,
      },
    ]);
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: q,
        history,
        file,
        summary,
        style: summary ? "brief" : style,
        compareFiles,
        files: !summary && attachments.length ? attachments : undefined,
      }),
      signal: abort.current?.signal,
    });
    await consume<RagEvent>(response, (e) => {
      if (e.type === "token")
        update(id, (m) => ({ ...m, content: m.content + e.text }));
      if (e.type === "replace") update(id, (m) => ({ ...m, content: e.text }));
      if (e.type === "sources")
        update(id, (m) => ({
          ...m,
          sources: e.sources,
          confidence: e.confidence,
          model: e.model,
          evidenceMs: e.evidenceMs,
        }));
      if (e.type === "step")
        update(id, (m) => ({
          ...m,
          steps: [...m.steps.filter((s) => s.name !== e.step.name), e.step],
        }));
      if (e.type === "done")
        update(id, (m) => ({
          ...m,
          ms: e.ms,
          grounded: e.grounded,
          cached: e.cached,
          firstTokenMs: e.firstTokenMs,
          method: e.method,
        }));
      if (e.type === "error") {
        update(id, (m) => ({ ...m, error: e.message }));
        throw new Error(e.message);
      }
    });
  }
  async function ask(q = question, file = scope, summary = false) {
    q = q.trim();
    if (
      !q ||
      busy ||
      preparingDemo ||
      indexing ||
      voice.recording ||
      voice.transcribing ||
      voice.starting
    )
      return;
    if (compare && !summary && (!scope || !second || scope === second)) {
      setError("Choose two different documents to compare.");
      return;
    }
    setError("");
    setNotice("");
    setQuestion("");
    setSidebar(false);
    setSource(null);
    setBusy(true);
    // The user's answer takes priority over background starter-question generation.
    suggestionAbort.current?.abort();
    voice.stopReading();
    abort.current = new AbortController();
    const history = messageRef.current
      .filter((m) => m.content && !m.error)
      .slice(-8)
      .map(({ role, content }) => ({ role, content: content.slice(0, 10000) }));
    setMessages((ms) => [
      ...ms,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: q,
        sources: [],
        steps: [],
      },
    ]);
    try {
      await runAnswer(
        q,
        history,
        compare && !summary ? undefined : file || undefined,
        summary,
        compare && !summary ? [scope, second] : undefined,
      );
    } catch (e) {
      const stopped = (e as Error).name === "AbortError";
      setMessages((ms) =>
        ms.map((m) =>
          m.role === "assistant" && m.ms === undefined
            ? {
                ...m,
                error: stopped
                  ? "Stopped · partial answer, not verified."
                  : (e as Error).message,
              }
            : m,
        ),
      );
      if (stopped) {
        setNotice("Generation stopped. Partial answers may be incomplete.");
      } else setError((e as Error).message);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  async function prepareDemo() {
    if (
      busy ||
      indexing ||
      preparingDemo ||
      voice.recording ||
      voice.transcribing ||
      voice.starting
    )
      return;
    setPreparingDemo(true);
    setPreparedDemo(false);
    setError("");
    suggestionAbort.current?.abort();
    voice.stopReading();
    warmAbort.current = new AbortController();
    try {
      await consume<{
        type: string;
        name?: string;
        status?: string;
        ms?: number;
        message?: string;
      }>(
        await fetch("/api/prepare", {
          method: "POST",
          signal: warmAbort.current.signal,
        }),
        (e) => {
          if (e.type === "progress")
            setNotice(`${e.name}${e.status === "done" ? " ✓" : "…"}`);
          if (e.type === "complete") {
            setPreparedDemo(true);
            setNotice(
              `المحركات جاهزة للعرض · ${((e.ms || 0) / 1000).toFixed(1)} ثانية تجهيز`,
            );
          }
          if (e.type === "error") throw new Error(e.message);
        },
      );
      await refresh();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setPreparingDemo(false);
      warmAbort.current = null;
    }
  }
  async function ingest(files?: FileList | File[]) {
    if (indexing || busy || preparingDemo) return;
    if (files && attachments.length + files.length > 100) {
      setError(
        "يمكن إرفاق 100 ملف في المحادثة. أزل بعض المرفقات قبل إضافة ملفات جديدة.",
      );
      return;
    }
    setIndexing(true);
    setError("");
    setProgress(null);
    try {
      let body: FormData | undefined;
      if (files?.length) {
        body = new FormData();
        Array.from(files).forEach((f) => body!.append("files", f));
      }
      const response = await fetch(body ? "/api/documents" : "/api/ingest", {
        method: "POST",
        body,
      });
      await consume<IngestEvent>(response, (e) => {
        setProgress(e);
        if (e.type === "error") throw new Error(e.message);
        if (e.type === "complete") {
          if (e.uploadedFiles?.length) {
            setAttachments((current) =>
              [...new Set([...current, ...e.uploadedFiles!])].slice(0, 100),
            );
            setScope("");
            setCompare(false);
          }
          setNotice(
            e.warnings.length
              ? e.warnings.join(" · ")
              : `${e.documents} documents ready. ${e.cached} reused from cache.`,
          );
        }
      });
      await refresh();
      loadSuggestions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIndexing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function exportMarkdown() {
    const text = `# DocMind conversation\n\n${messages.map((m) => `## ${m.role === "user" ? "You" : "DocMind"}${m.file ? ` · ${m.file}` : ""}\n\n${m.content}\n\n${m.sources.map((s) => `[${s.citation}] ${s.file}${s.page ? ` · p. ${s.page}` : ""} · ${s.section}\n> ${s.text.replaceAll("\n", "\n> ")}`).join("\n\n")}`).join("\n\n---\n\n")}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([text], { type: "text/markdown;charset=utf-8" }),
    );
    a.download = "DocMind-conversation.md";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const latest = [...messages].reverse().find((m) => m.role === "assistant"),
    durations = messages.filter((m) => m.ms).map((m) => m.ms!),
    avg = durations.length
      ? (
          durations.reduce((a, b) => a + b, 0) /
          durations.length /
          1000
        ).toFixed(1)
      : null;
  const ready = !!health?.ready,
    docs = library.documents.filter((d) =>
      d.name.toLowerCase().includes(filter.toLowerCase()),
    );
  return (
    <div className="workspace">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? "mobile-open" : ""}`}>
        <a className="brand" href="/">
          <span className="brand-symbol">
            <Layers3 size={24} />
          </span>
          <span>
            Doc<span className="brand-light">Mind</span>
            <small>YOUR LOCAL KNOWLEDGE SPACE</small>
          </span>
          <span className="version">1.0</span>
        </a>
        <button
          className="new-chat"
          disabled={busy || indexing || preparingDemo}
          onClick={() => {
            setMessages([]);
            setSource(null);
            setQuestion("");
            setAttachments([]);
            setScope("");
            setCompare(false);
            input.current?.focus();
          }}
        >
          <Plus size={17} /> New conversation <span>⇧ ⌘ O</span>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <button className="nav-item active" onClick={() => setSidebar(false)}>
          <MessageSquare size={17} /> Ask your documents{" "}
          <span className="tiny-dot" />
        </button>
        <Link className="nav-item" href="/evaluate">
          <FlaskConical size={17} /> Quality lab{" "}
          <span className="beta-tag">BETA</span>
        </Link>
        <Link className="nav-item" href="/investigate">
          <ShieldCheck size={17} /> محقق المستندات
        </Link>
        <div className="library-heading">
          <span>KNOWLEDGE LIBRARY</span>
          <span className="count">{library.documents.length}</span>
          <button
            title="Re-index library"
            aria-label="Re-index library"
            disabled={indexing || busy || preparingDemo}
            onClick={() => ingest()}
          >
            <RefreshCw size={14} className={indexing ? "spin" : ""} />
          </button>
        </div>
        <label className="library-search">
          <Search size={14} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find a document…"
            aria-label="Find a document"
          />
          <kbd>/</kbd>
        </label>
        <div className="documents">
          {!loaded ? (
            <div className="skeleton-list">
              {[1, 2, 3].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : docs.length ? (
            docs.map((d, i) => (
              <div
                key={d.name}
                className={`document ${attachments.includes(d.name) ? "selected" : ""}`}
              >
                <button
                  className="document-main"
                  aria-pressed={attachments.includes(d.name)}
                  title="إرفاق أو إزالة الملف من هذه المحادثة"
                  disabled={busy || indexing || preparingDemo}
                  onClick={() => {
                    toggleAttachment(d.name);
                  }}
                >
                  <span className={`file-icon file-${i % 4}`}>
                    <FileText size={18} />
                  </span>
                  <span>
                    <strong title={d.name}>{displayName(d.name)}</strong>
                    <small>
                      {d.name.split(".").pop()?.toUpperCase()}
                      <span>·</span>
                      {d.chunks} passages
                    </small>
                  </span>
                </button>
                <button
                  className="summary-button"
                  title={`Summarize ${d.name}`}
                  aria-label={`Summarize ${d.name}`}
                  disabled={busy || indexing || preparingDemo}
                  onClick={() => {
                    setCompare(false);
                    ask(`Summarize the key ideas in ${d.name}.`, d.name, true);
                  }}
                >
                  <Sparkles size={14} />
                </button>
                {attachments.includes(d.name) ? (
                  <Check size={14} aria-label="Attached" />
                ) : (
                  <span className="indexed-dot" />
                )}
              </div>
            ))
          ) : (
            <div className="library-empty">
              <FolderOpen size={26} />
              <p>
                {filter
                  ? "No matching documents"
                  : "Your knowledge starts here"}
              </p>
              <small>
                {filter
                  ? "Try another name."
                  : "Add your first document below."}
              </small>
            </div>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.md,.txt,.docx"
          multiple
          hidden
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
        <button
          className={`upload-zone ${drag ? "dragging" : ""}`}
          disabled={busy || indexing || preparingDemo}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            ingest(e.dataTransfer.files);
          }}
          onClick={() => fileInput.current?.click()}
        >
          {indexing ? (
            <LoaderCircle size={22} className="spin" />
          ) : (
            <Upload size={22} />
          )}
          <strong>
            {indexing ? "Connecting your knowledge…" : "Drop knowledge here"}
          </strong>
          <span>
            {indexing && progress?.type === "progress"
              ? progress.message
              : "or click to browse your files"}
          </span>
          <small>
            PDF, DOCX, TXT, MD · {library.maxUpload / 1024 / 1024} MB max
          </small>
          {indexing && (
            <div className="upload-track">
              <span
                style={{
                  width: `${progress?.type === "progress" ? Math.max(4, (progress.current / progress.total) * 100) : 4}%`,
                }}
              />
            </div>
          )}
        </button>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={18} />
            <div>
              <strong>Private by design</strong>
              <p>
                Your documents never leave
                <br />
                this device. Ever.
              </p>
            </div>
            <span className="status-dot" />
          </div>
          <div className="profile">
            <span className="avatar">Y</span>
            <div>
              <strong>Your workspace</strong>
              <small>Local edition</small>
            </div>
            <button
              title="Toggle light / dark theme"
              aria-label="Toggle light / dark theme"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              onClick={() => setSidebar(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span className="workspace-icon">
              <FolderOpen size={16} />
            </span>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>Ask your documents</strong>
          </div>
          <div className="top-actions">
            <button
              className={`prepare-button ${preparedDemo ? "ready" : ""}`}
              disabled={
                busy ||
                indexing ||
                voice.recording ||
                voice.transcribing ||
                voice.starting
              }
              onClick={() =>
                preparingDemo ? warmAbort.current?.abort() : prepareDemo()
              }
              aria-label={preparingDemo ? "Cancel preparation" : "Prepare demo"}
            >
              {preparingDemo ? (
                <LoaderCircle className="spin" size={14} />
              ) : preparedDemo ? (
                <Check size={14} />
              ) : (
                <Zap size={14} />
              )}
              <span>
                {preparingDemo
                  ? "إلغاء التجهيز"
                  : preparedDemo
                    ? "تجهيز مجددًا"
                    : "تجهيز العرض"}
              </span>
            </button>
            <span className="local-badge">
              <span className="status-dot" />
              100% local <span className="offline-word">/ offline</span>
            </span>
            <button
              className="icon-button"
              aria-label="Export Markdown"
              title="Export conversation as Markdown"
              onClick={exportMarkdown}
              disabled={!messages.length}
            >
              <Download size={17} />
            </button>
            <button
              className={`icon-button ${inspector ? "selected" : ""}`}
              aria-label="Toggle insight panel"
              title="Toggle insight panel"
              onClick={() => {
                if (window.innerWidth <= 1100) {
                  setInspector(true);
                  setMobileInspector(!mobileInspector);
                  setSource(null);
                } else setInspector(!inspector);
              }}
            >
              <PanelRightClose size={17} />
            </button>
          </div>
        </header>
        <div className="workspace-body">
          <section className="chat-area">
            <div className="chat-toolbar">
              <div className="workspace-title">
                <span className="small-spark">
                  <Sparkles size={15} />
                </span>
                <span>
                  {messages.length
                    ? "A little more clarity."
                    : "Your next insight starts here."}
                </span>
              </div>
              <button
                className={`compare-toggle ${compare ? "enabled" : ""}`}
                onClick={() => {
                  setCompare(!compare);
                  if (
                    !scope ||
                    !conversationDocuments.some((d) => d.name === scope)
                  )
                    setScope(conversationDocuments[0]?.name || "");
                  if (
                    !second ||
                    !conversationDocuments.some((d) => d.name === second)
                  )
                    setSecond(conversationDocuments[1]?.name || "");
                }}
                disabled={
                  busy ||
                  indexing ||
                  preparingDemo ||
                  conversationDocuments.length < 2
                }
              >
                <GitCompareArrows size={14} />
                مقارنة وتعارض<span className="new-tag">NEW</span>
              </button>
            </div>
            <div
              className="style-switch"
              role="group"
              aria-label="Answer style"
            >
              {(
                [
                  ["brief", "مختصر"],
                  ["detailed", "مفصّل"],
                  ["decision", "بطاقة قرار"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy || preparingDemo}
                  aria-pressed={style === value}
                  onClick={() => setStyle(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="conversation-scroll">
              {!messages.length ? (
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65 }}
                  className="welcome"
                >
                  <div className="intelligence-orb">
                    <div className="orb-ring ring-one" />
                    <div className="orb-ring ring-two" />
                    <div className="orb-core">
                      <Layers3 size={38} strokeWidth={1.25} />
                    </div>
                    <span className="orb-star star-one">✦</span>
                    <span className="orb-star star-two">✧</span>
                    <span className="orb-point" />
                  </div>
                  <div className="eyebrow">
                    <span />
                    YOUR KNOWLEDGE. CONNECTED.
                  </div>
                  <h1>
                    Big ideas.
                    <br />
                    <span>Already in your documents.</span>
                  </h1>
                  <p className="welcome-copy">
                    Turn your files into a conversation. Find connections,
                    <br className="desktop-br" /> get clear answers, and follow
                    every insight to its source.
                  </p>
                  <div className="capability-row">
                    <span>
                      <ShieldCheck size={13} />
                      Entirely private
                    </span>
                    <span>
                      <BookOpen size={13} />
                      Backed by sources
                    </span>
                    <span>
                      <Globe2 size={13} />
                      English & Arabic
                    </span>
                  </div>
                  <div className="starter-heading">
                    <Sparkles size={13} />
                    {suggestions.length
                      ? "A FEW PLACES TO START"
                      : "EXPLORE YOUR KNOWLEDGE"}
                  </div>
                  <div className="suggestions">
                    {(suggestions.length
                      ? suggestions
                      : [
                          "What are the key ideas across my documents?",
                          "What milestones and deadlines should I know?",
                          "Which risks need the most attention?",
                          "ما أهم المعلومات في المستندات؟",
                        ]
                    ).map((q, i) => (
                      <button
                        key={q}
                        onClick={() => ask(q)}
                        disabled={!library.chunks || busy || preparingDemo}
                      >
                        <span className={`suggestion-icon s-${i}`}>
                          {i === 0 ? (
                            <Sparkles size={17} />
                          ) : i === 1 ? (
                            <Layers3 size={17} />
                          ) : i === 2 ? (
                            <Zap size={17} />
                          ) : (
                            <Globe2 size={17} />
                          )}
                        </span>
                        <span dir="auto">{q}</span>
                        <ArrowUp size={14} />
                      </button>
                    ))}
                  </div>
                  <div className="welcome-footnote">
                    <span className="status-dot" />
                    {library.chunks
                      ? `${library.documents.length} documents connected. A world of answers waiting.`
                      : "Upload your documents to bring your knowledge to life."}
                  </div>
                </motion.div>
              ) : (
                <div className="messages">
                  {messages.map((m) => (
                    <motion.article
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={m.id}
                      className={`message ${m.role} ${m.compared ? "comparison-card" : ""} ${m.style === "decision" ? "decision-card" : ""}`}
                    >
                      <div className="message-avatar">
                        {m.role === "assistant" ? (
                          <Layers3 size={18} />
                        ) : (
                          <span>Y</span>
                        )}
                      </div>
                      <div className="message-body">
                        <div className="message-label">
                          {m.role === "assistant" ? "DocMind" : "You"}
                          {m.file && (
                            <span className="scope-label">
                              {displayName(m.file)}
                            </span>
                          )}
                          {m.role === "assistant" && m.ms && (
                            <span className="response-time">
                              {(m.ms / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                        {!!m.sources.length && (
                          <details
                            className="early-evidence"
                            open={!m.content && !m.error}
                            dir="rtl"
                          >
                            <summary>
                              <Search size={13} /> الأدلة المسترجعة
                              {m.evidenceMs !== undefined && (
                                <small>
                                  {(m.evidenceMs / 1000).toFixed(1)} ثانية
                                </small>
                              )}
                            </summary>
                            <p>
                              مقاطع ذات صلة بالسؤال؛ ليست إجابة مؤكدة.{" "}
                              {busy && !m.content
                                ? "يجري إعداد الإجابة…"
                                : "افتح المصدر للتحقق."}
                            </p>
                            {m.sources.slice(0, 3).map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setSource(s);
                                  setInspector(true);
                                }}
                              >
                                <strong>
                                  [{s.citation}] {displayName(s.file)}
                                  {s.page ? ` · ص ${s.page}` : ""}
                                </strong>
                                <span dir={isArabic(s.text) ? "rtl" : "ltr"}>
                                  {s.text.slice(0, 420)}
                                  {s.text.length > 420 ? "…" : ""}
                                </span>
                              </button>
                            ))}
                          </details>
                        )}
                        <div
                          className="markdown"
                          dir={isArabic(m.content) ? "rtl" : "ltr"}
                        >
                          {m.content ? (
                            <Markdown
                              text={m.content}
                              onCitation={(n) => {
                                setSource(
                                  m.sources.find((s) => s.citation === n) ||
                                    null,
                                );
                                setInspector(true);
                              }}
                            />
                          ) : m.error ? (
                            <p className="inline-error">{m.error}</p>
                          ) : busy ? (
                            <div className="typing">
                              <span />
                              <span />
                              <span />
                              <small>Finding clarity in your documents</small>
                            </div>
                          ) : (
                            <p className="muted">Generation stopped.</p>
                          )}
                        </div>
                        {m.content && m.error && (
                          <p className="inline-error">{m.error}</p>
                        )}
                        {!!m.sources.length && m.content && (
                          <div className="answer-evidence">
                            <div className="citation-chips">
                              {m.sources
                                .filter((s) =>
                                  m.content.includes(`[${s.citation}]`),
                                )
                                .map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => {
                                      setSource(s);
                                      setInspector(true);
                                    }}
                                  >
                                    <span>{s.citation}</span>
                                    <FileText size={12} />
                                    {displayName(s.file)}
                                    {s.page && <small>p. {s.page}</small>}
                                  </button>
                                ))}
                            </div>
                            {m.ms && (
                              <div className="answer-actions">
                                <span
                                  title={
                                    m.cached
                                      ? "Reused a completed answer for the same documents and conversation"
                                      : "Time until the first answer text appeared"
                                  }
                                >
                                  {m.cached
                                    ? "Instant replay"
                                    : m.firstTokenMs !== undefined
                                      ? `First text ${(m.firstTokenMs / 1000).toFixed(1)}s`
                                      : ""}
                                </span>
                                <span className={`confidence ${m.confidence}`}>
                                  <span />
                                  {m.grounded
                                    ? `${m.confidence} retrieval confidence`
                                    : /couldn't find|لم أجد/.test(m.content)
                                      ? "No grounded answer found"
                                      : "Source verification needed"}
                                </span>
                                {!m.cached && m.method === "extractive" && (
                                  <span className="mode-label">
                                    نقل مباشر من المستند
                                  </span>
                                )}
                                {m.compared && (
                                  <span className="mode-label">
                                    مقارنة موثّقة
                                  </span>
                                )}
                                {m.style === "decision" && (
                                  <span className="mode-label">
                                    بطاقة قرار · راجع المصادر
                                  </span>
                                )}
                                <button
                                  title={
                                    voice.reading === m.id
                                      ? "إيقاف القراءة"
                                      : "قراءة الإجابة بصوت محلي"
                                  }
                                  aria-label={
                                    voice.reading === m.id
                                      ? "Stop reading answer"
                                      : "Read answer aloud"
                                  }
                                  aria-pressed={voice.reading === m.id}
                                  disabled={
                                    voice.recording ||
                                    voice.starting ||
                                    voice.transcribing ||
                                    preparingDemo ||
                                    busy
                                  }
                                  onClick={() =>
                                    voice.readAloud(m.id, m.content)
                                  }
                                >
                                  {voice.reading === m.id ? (
                                    voice.preparing ? (
                                      <LoaderCircle
                                        className="spin"
                                        size={14}
                                      />
                                    ) : (
                                      <Square size={14} />
                                    )
                                  ) : (
                                    <Volume2 size={14} />
                                  )}
                                </button>
                                <button
                                  title="Copy answer"
                                  aria-label="Copy answer"
                                  onClick={() =>
                                    navigator.clipboard
                                      .writeText(m.content)
                                      .then(() => setNotice("Answer copied."))
                                      .catch(() =>
                                        setNotice(
                                          "Could not access clipboard.",
                                        ),
                                      )
                                  }
                                >
                                  <BookOpen size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
              <div ref={bottom} />
            </div>
            <div className="composer-area">
              <div className="speech-controls" dir="rtl">
                <label>
                  لغة التسجيل{" "}
                  <select
                    aria-label="Recording language"
                    value={voice.language}
                    disabled={
                      voice.recording ||
                      voice.starting ||
                      voice.transcribing ||
                      busy ||
                      preparingDemo
                    }
                    onChange={(e) =>
                      voice.setLanguage(e.target.value as "ar" | "en" | "auto")
                    }
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="auto">تلقائي</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={
                    voice.recording ||
                    voice.transcribing ||
                    voice.starting ||
                    busy ||
                    preparingDemo
                  }
                  onClick={() => audioInput.current?.click()}
                >
                  استيراد تسجيل
                </button>
                <span role="status">
                  {voice.recording
                    ? "● جارٍ التسجيل"
                    : voice.transcribing
                      ? "جارٍ تفريغ الصوت…"
                      : voice.starting
                        ? "انتظار الميكروفون…"
                        : "صوت محلي"}
                </span>
                <input
                  ref={audioInput}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void voice.transcribe(file);
                    e.target.value = "";
                  }}
                />
              </div>
              {(voice.audioUrl || voice.preparing) && (
                <div className="speech-player" dir="rtl">
                  <span>
                    {voice.preparing
                      ? "جارٍ تجهيز القراءة المحلية…"
                      : "قراءة الإجابة"}
                  </span>
                  {voice.audioUrl && (
                    <audio
                      ref={voice.player}
                      src={voice.audioUrl}
                      controls
                      aria-label="Answer audio player"
                      onError={() =>
                        setNotice(
                          "تعذر تشغيل الصوت. حاول مرة أخرى أو افتح التطبيق في Chrome أو Edge.",
                        )
                      }
                    />
                  )}
                  <button
                    type="button"
                    onClick={voice.stopReading}
                    aria-label="Close audio player"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {(error || notice || library.stale) && (
                <div
                  className={`notice ${error || library.stale ? "error" : ""}`}
                  role={error ? "alert" : "status"}
                >
                  <span>
                    {error ||
                      (library.stale
                        ? "Embedding settings changed. Re-index your library."
                        : notice)}
                  </span>
                  <button
                    aria-label="Dismiss notice"
                    onClick={() => {
                      setError("");
                      setNotice("");
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {loaded && !health?.ollama && !error && (
                <div className="connection-notice">
                  <span className="amber-dot" />
                  Ollama is offline.
                  <Link href="/health">
                    Check connection <ArrowRight size={12} />
                  </Link>
                </div>
              )}
              <div className="chat-attachments" dir="rtl">
                <span>
                  <FolderOpen size={14} /> ملفات هذه المحادثة{" "}
                  {attachments.length
                    ? `(${attachments.length})`
                    : "· المكتبة كاملة"}
                </span>
                {attachments.length > 0 && (
                  <small>
                    يُبحث في المرفقات فقط · اختر ملفًا من المكتبة لإضافته
                  </small>
                )}
                <div className="attachment-chips">
                  {attachments.map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={busy || indexing || preparingDemo}
                      onClick={() => toggleAttachment(name)}
                      title={`إزالة ${name} من المحادثة دون حذف الملف`}
                    >
                      <FileText size={13} />
                      <span>{displayName(name)}</span>
                      <X size={12} />
                    </button>
                  ))}
                </div>
              </div>
              {compare && (
                <div className="compare-selectors">
                  <span>
                    <GitCompareArrows size={14} />
                    Compare
                  </span>
                  <select
                    aria-label="First comparison document"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    {conversationDocuments.map((d) => (
                      <option key={d.name} value={d.name}>
                        {displayName(d.name)}
                      </option>
                    ))}
                  </select>
                  <span>with</span>
                  <select
                    aria-label="Second comparison document"
                    value={second}
                    onChange={(e) => setSecond(e.target.value)}
                  >
                    {conversationDocuments.map((d) => (
                      <option key={d.name} value={d.name}>
                        {displayName(d.name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <form
                className={`composer ${busy ? "is-busy" : ""}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  ask();
                }}
              >
                <textarea
                  ref={input}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      ask();
                    }
                  }}
                  placeholder={
                    compare
                      ? "Ask the same question across two documents…"
                      : "Ask anything about your documents…"
                  }
                  aria-label="Ask anything about your documents"
                  dir={isArabic(question) ? "rtl" : "ltr"}
                  rows={2}
                />
                <div className="composer-controls">
                  <div className="composer-left">
                    <button
                      type="button"
                      className="attach-button"
                      title="Add documents"
                      aria-label="Add documents"
                      disabled={busy || indexing || preparingDemo}
                      onClick={() => fileInput.current?.click()}
                    >
                      <Plus size={19} />
                    </button>
                    <span className="control-divider" />
                    <div className="scope-select">
                      <Layers3 size={13} />
                      <select
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        disabled={compare}
                        aria-label="Search scope"
                      >
                        <option value="">
                          {attachments.length
                            ? `ملفات المحادثة (${attachments.length})`
                            : "All documents"}
                        </option>
                        {conversationDocuments.map((d) => (
                          <option key={d.name} value={d.name}>
                            {displayName(d.name)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={11} />
                    </div>
                  </div>
                  <div className="composer-right">
                    <span className="enter-hint">↵ to send</span>
                    <button
                      type="button"
                      className={`voice-button ${voice.recording ? "listening" : ""}`}
                      title={
                        voice.starting
                          ? "إلغاء انتظار الميكروفون"
                          : voice.recording
                            ? "إيقاف التسجيل"
                            : "تسجيل السؤال بصوتك"
                      }
                      aria-label={
                        voice.starting
                          ? "Cancel microphone request"
                          : voice.recording
                            ? "Stop recording"
                            : "Record question"
                      }
                      aria-pressed={voice.recording}
                      disabled={
                        voice.transcribing || busy || indexing || preparingDemo
                      }
                      onClick={voice.toggleRecording}
                    >
                      {voice.starting || voice.transcribing ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : voice.recording ? (
                        <Square size={18} />
                      ) : (
                        <Mic size={18} />
                      )}
                    </button>
                    {busy ? (
                      <button
                        type="button"
                        className="send-button"
                        aria-label="Stop generation"
                        onClick={() => abort.current?.abort()}
                      >
                        <Square size={15} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        className="send-button"
                        aria-label="Send question"
                        type="submit"
                        disabled={
                          !question.trim() ||
                          !library.chunks ||
                          indexing ||
                          preparingDemo ||
                          voice.recording ||
                          voice.transcribing ||
                          voice.starting
                        }
                      >
                        <ArrowUp size={20} />
                      </button>
                    )}
                  </div>
                </div>
              </form>
              <div className="composer-caption">
                <span>
                  <ShieldCheck size={11} />
                  Your curiosity stays yours. Powered locally by Ollama.
                </span>
                <span>
                  <Command size={10} /> K to focus
                </span>
              </div>
            </div>
          </section>
          <AnimatePresence>
            {inspector && (
              <motion.aside
                ref={inspectorPanel}
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 310 }}
                exit={{ opacity: 0, width: 0 }}
                className={`inspector ${source ? "show-source" : ""} ${mobileInspector ? "mobile-insights" : ""}`}
              >
                {source ? (
                  <div className="source-panel">
                    <div className="inspector-heading">
                      <span>
                        <BookOpen size={16} />
                        Source passage
                      </span>
                      <button
                        aria-label="Close source"
                        onClick={() => setSource(null)}
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="source-file">
                      <span className="file-icon">
                        <FileText size={21} />
                      </span>
                      <h3>{displayName(source.file)}</h3>
                      <p>{source.file}</p>
                    </div>
                    <div className="source-metadata">
                      <span>Source [{source.citation}]</span>
                      <span>
                        {source.page ? `Page ${source.page}` : "Text document"}
                      </span>
                    </div>
                    <h4>{source.section}</h4>
                    {source.file.toLowerCase().endsWith(".pdf") && (
                      <button
                        className="primary-button pdf-open"
                        onClick={() => setPdfSource(source)}
                      >
                        <BookOpen size={15} />
                        عرض الدليل داخل PDF
                      </button>
                    )}
                    <div
                      className="source-excerpt"
                      dir={isArabic(source.text) ? "rtl" : "ltr"}
                    >
                      <mark>{source.text}</mark>
                    </div>
                    <p className="source-caption">
                      Exact indexed passage. Highlighted so you can verify the
                      answer yourself.
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() => setSource(null)}
                    >
                      <ArrowRight size={14} />
                      Back to insights
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="inspector-heading">
                      <span>
                        <Sparkles size={16} />
                        Behind the answer
                      </span>
                      <span className={`live-badge ${busy ? "working" : ""}`}>
                        <span />
                        {busy ? "LIVE" : "READY"}
                      </span>
                    </div>
                    <div className="inspector-intro">
                      <h3>
                        A little transparency.
                        <br />A lot more trust.
                      </h3>
                      <p>
                        Follow the path from your question
                        <br />
                        to a grounded answer.
                      </p>
                    </div>
                    <div className="pipeline-heading">
                      HOW IT THINKS <span>VISIBLE BY DESIGN</span>
                    </div>
                    <div className="pipeline">
                      {pipeline.map((name, i) => {
                        const step = latest?.steps.find((s) => s.name === name);
                        const Icon = iconFor[i];
                        return (
                          <div
                            key={name}
                            className={`pipeline-step ${step?.status || "waiting"}`}
                          >
                            <span className="step-icon">
                              {step?.status === "running" ? (
                                <LoaderCircle className="spin" size={16} />
                              ) : step?.status === "done" ? (
                                <Check size={16} />
                              ) : (
                                <Icon size={16} />
                              )}
                            </span>
                            <div>
                              <strong>{name}</strong>
                              <small>
                                {step?.detail ||
                                  [
                                    "Understanding your question",
                                    "Finding relevant passages",
                                    "Connecting the best evidence",
                                    "Turning context into clarity",
                                  ][i]}
                              </small>
                            </div>
                            <span className="step-time">
                              {step?.ms !== undefined
                                ? `${step.ms} ms`
                                : String(i + 1).padStart(2, "0")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="inspector-divider" />
                    <div className="retrieval-heading">
                      <span>RETRIEVED CONTEXT</span>
                      <span>{latest?.sources.length || 0} passages</span>
                    </div>
                    {latest?.sources.length ? (
                      <div className="retrieval-list">
                        {latest.sources.map((s) => (
                          <button
                            className="retrieval-card"
                            key={s.id}
                            onClick={() => setSource(s)}
                          >
                            <div>
                              <span className="source-number">
                                {s.citation}
                              </span>
                              <strong>{displayName(s.file)}</strong>
                              <ChevronRight size={13} />
                            </div>
                            <p>{s.text.replace(/^#+ /, "").slice(0, 110)}…</p>
                            <div className="similarity-label">
                              <span>Semantic similarity</span>
                              <strong>
                                {Math.round(Math.max(0, s.similarity) * 100)}%
                              </strong>
                            </div>
                            <div className="similarity-bar">
                              <span
                                style={{
                                  width: `${Math.max(0, s.similarity) * 100}%`,
                                }}
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="context-empty">
                        <div className="context-illustration">
                          <div />
                          <div />
                          <Search size={21} />
                        </div>
                        <strong>Evidence will appear here</strong>
                        <p>
                          Ask a question to see the passages
                          <br />
                          that shape your answer.
                        </p>
                      </div>
                    )}
                    <div className="trust-note">
                      <ShieldCheck size={16} />
                      <p>
                        Every answer has a paper trail.
                        <br />
                        <strong>Trust the source, not just the AI.</strong>
                      </p>
                    </div>
                    <div className="confidence-note">
                      Retrieval confidence measures evidence similarity, not
                      guaranteed accuracy.
                    </div>
                  </>
                )}
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
        <footer className="stats-bar">
          <div>
            <span className={`status-dot ${ready ? "" : "not-ready"}`} />
            <Link href="/health">
              {ready
                ? "All systems local"
                : loaded
                  ? "Check system health"
                  : "Connecting…"}
            </Link>
            <span className="stats-divider" />
            <span>
              <FileText size={12} />
              {library.documents.length} documents
            </span>
            <span>
              <Layers3 size={12} />
              {library.chunks} chunks
            </span>
            <span className="avg-stat">
              <Zap size={12} />
              {avg ? `${avg}s avg` : "Ready to explore"}
            </span>
          </div>
          <div>
            <span className="model-label">
              <span className="model-dot" />
              {health?.generation || library.model}
            </span>
            <button
              onClick={() => window.print()}
              disabled={!messages.length}
              title="Export PDF using browser print"
              aria-label="Export PDF"
            >
              <Download size={12} />
              <span>PDF</span>
            </button>
            <span className="local-small">
              <ShieldCheck size={12} />
              OFFLINE FIRST
            </span>
          </div>
        </footer>
      </main>
      {pdfSource && (
        <PdfEvidence
          key={pdfSource.file}
          source={pdfSource}
          onClose={closePdf}
        />
      )}
    </div>
  );
}
