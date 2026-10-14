import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const python = path.resolve(
  process.env.VOICE_PYTHON ||
    path.join(
      root,
      ".voice-venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    ),
);
const voiceRoot = path.join(root, "data", "voice");
export async function voiceStatus() {
  const exists = (file: string) =>
    fs.access(file).then(
      () => true,
      () => false,
    );
  const [runtime, transcribe, ar, en] = await Promise.all([
    exists(python),
    exists(path.join(voiceRoot, "whisper-small/model.bin")),
    exists(
      path.join(
        voiceRoot,
        "voices/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx",
      ),
    ),
    exists(
      path.join(
        voiceRoot,
        "voices/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
      ),
    ),
  ]);
  return {
    ready: runtime && transcribe && ar && en,
    transcribe: runtime && transcribe,
    voices: { ar: runtime && ar, en: runtime && en },
  };
}
type VoiceRequest =
  | { action: "speak"; text: string; language: "ar" | "en" }
  | { action: "transcribe"; audio: string; language: "ar" | "en" | "auto" }
  | { action: "warmup" };
type VoiceResult = {
  audio?: string;
  text?: string;
  language?: string;
  ready?: boolean;
  error?: string;
};
type Worker = {
  child: ChildProcessWithoutNullStreams;
  output: string;
  errors: string;
  reply?: (error: Error | null, result?: VoiceResult) => void;
};
type Pool = {
  worker?: Worker;
  tail: Promise<unknown>;
  jobs: number;
  idle?: ReturnType<typeof setTimeout>;
};
const globalPool = globalThis as typeof globalThis & {
  docmindVoicePool?: Pool;
};
const pool = (globalPool.docmindVoicePool ||= {
  tail: Promise.resolve(),
  jobs: 0,
});
function stopWorker(worker: Worker) {
  if (pool.worker === worker) pool.worker = undefined;
  worker.child.kill();
}
export function closeVoiceWorker() {
  clearTimeout(pool.idle);
  if (pool.worker) stopWorker(pool.worker);
}
function getWorker() {
  if (pool.worker) return pool.worker;
  const child = spawn(python, [path.join(root, "voice/worker.py")], {
    cwd: root,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      HF_HUB_OFFLINE: "1",
      HF_HUB_DISABLE_TELEMETRY: "1",
    },
  });
  const worker: Worker = { child, output: "", errors: "" };
  pool.worker = worker;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (text: string) => {
    worker.output += text;
    if (worker.output.length > 24 * 1024 * 1024) {
      worker.reply?.(new Error("Speech output too large."));
      stopWorker(worker);
      return;
    }
    const newline = worker.output.indexOf("\n");
    if (newline < 0) return;
    const line = worker.output.slice(0, newline);
    worker.output = worker.output.slice(newline + 1);
    try {
      const result = JSON.parse(line) as VoiceResult;
      worker.reply?.(result.error ? new Error(result.error) : null, result);
    } catch (e) {
      worker.reply?.(e as Error);
      stopWorker(worker);
    }
  });
  child.stderr.on("data", (text: string) => {
    worker.errors = (worker.errors + text).slice(-1200);
  });
  child.on("error", () => {
    worker.reply?.(
      new Error("Local speech is not installed. Run npm run setup:voice once."),
    );
    stopWorker(worker);
  });
  child.on("close", () => {
    if (pool.worker === worker) pool.worker = undefined;
    worker.reply?.(
      new Error(`Local speech stopped. ${worker.errors.slice(-250)}`),
    );
  });
  child.stdin.on("error", () => {
    worker.reply?.(new Error("Local speech worker disconnected."));
    stopWorker(worker);
  });
  return worker;
}
function execute(
  request: VoiceRequest,
  signal?: AbortSignal,
): Promise<VoiceResult> {
  signal?.throwIfAborted();
  clearTimeout(pool.idle);
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    let done = false;
    const finish = (error: Error | null, result?: VoiceResult) => {
      if (done) return;
      done = true;
      worker.reply = undefined;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(result || {});
    };
    const abort = () => {
      stopWorker(worker);
      finish(new Error("Speech request cancelled."));
    };
    const timer = setTimeout(() => {
      stopWorker(worker);
      finish(
        new Error("Local speech timed out. Try a shorter recording or answer."),
      );
    }, 180000);
    worker.reply = finish;
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.child.stdin.write(JSON.stringify(request) + "\n");
  });
}
export function runVoice(
  request: VoiceRequest,
  signal?: AbortSignal,
): Promise<VoiceResult> {
  signal?.throwIfAborted();
  if (pool.jobs >= 2)
    return Promise.reject(
      new Error(
        "الصوت المحلي مشغول. انتظر انتهاء العملية الحالية ثم حاول مجددًا.",
      ),
    );
  pool.jobs++;
  const task = pool.tail.then(() => execute(request, signal));
  pool.tail = task.catch(() => {});
  return task.finally(() => {
    pool.jobs--;
    if (!pool.jobs) {
      clearTimeout(pool.idle);
      pool.idle = setTimeout(closeVoiceWorker, 5 * 60 * 1000);
      pool.idle.unref();
    }
  });
}
