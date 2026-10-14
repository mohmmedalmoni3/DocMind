"use client";
import { useEffect, useRef, useState } from "react";
import { isArabic } from "./client";

export function useLocalVoice(
  setQuestion: (text: string) => void,
  notify: (text: string) => void,
) {
  const [language, setLanguage] = useState<"ar" | "en" | "auto">("ar");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const tracks = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const ttsAbort = useRef<AbortController | null>(null);
  const sttAbort = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const alive = useRef(true);
  const micStarting = useRef(false);
  const micEpoch = useRef(0);
  const url = useRef<string | null>(null);

  function releaseMic() {
    clearTimeout(timer.current);
    tracks.current?.getTracks().forEach((t) => t.stop());
    tracks.current = null;
  }
  function stopReading() {
    requestId.current++;
    ttsAbort.current?.abort();
    player.current?.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
    setAudioUrl(null);
    setReading(null);
    setPreparing(false);
  }
  function cancelInput() {
    micEpoch.current++;
    micStarting.current = false;
    setStarting(false);
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
    }
    releaseMic();
    sttAbort.current?.abort();
    setRecording(false);
    setTranscribing(false);
  }
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      micEpoch.current++;
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      releaseMic();
      sttAbort.current?.abort();
      ttsAbort.current?.abort();
      player.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);
  useEffect(() => {
    if (audioUrl)
      player.current
        ?.play()
        .catch(() => notify("الصوت جاهز. اضغط تشغيل في مشغّل الصوت أدناه."));
  }, [audioUrl, notify]);

  async function transcribe(audio: Blob, selected = language) {
    if (!audio.size) {
      notify("لم يُسجّل صوت. تحقق من الميكروفون وحاول مجددًا.");
      return;
    }
    if (audio.size > 8 * 1024 * 1024) {
      notify("التسجيل كبير. استخدم مقطعًا لا يتجاوز دقيقة و8 ميغابايت.");
      return;
    }
    sttAbort.current?.abort();
    const controller = new AbortController();
    sttAbort.current = controller;
    setTranscribing(true);
    notify("جارٍ تحويل التسجيل إلى نص على جهازك…");
    try {
      const form = new FormData();
      form.append("audio", audio, "question.audio");
      form.append("language", selected);
      const response = await fetch("/api/voice", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تفريغ التسجيل.");
      if (!alive.current || controller.signal.aborted) return;
      if (!data.text?.trim()) {
        notify("لم أسمع كلامًا واضحًا. اقترب من الميكروفون وأعد المحاولة.");
        return;
      }
      setQuestion(data.text);
      notify("تم التفريغ محليًا. راجع السؤال ثم اضغط إرسال.");
    } catch (e) {
      if (!controller.signal.aborted && alive.current)
        notify((e as Error).message);
    } finally {
      if (alive.current && sttAbort.current === controller)
        setTranscribing(false);
    }
  }

  async function toggleRecording() {
    if (micStarting.current) {
      cancelInput();
      notify(
        "أُلغي انتظار الميكروفون. يمكنك المحاولة مجددًا أو استيراد تسجيل.",
      );
      return;
    }
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
      return;
    }
    if (transcribing || micStarting.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      notify(
        "المتصفح لا يدعم التسجيل هنا. افتح التطبيق في Chrome أو Edge، أو ارفع تسجيلًا صوتيًا.",
      );
      return;
    }
    micStarting.current = true;
    const epoch = ++micEpoch.current;
    const permissionTimer = setTimeout(() => {
      if (!alive.current || micEpoch.current !== epoch) return;
      cancelInput();
      notify(
        "لم يصل إذن الميكروفون. اسمح به من المتصفح، أو افتح التطبيق في Chrome أو Edge، أو استورد تسجيلًا.",
      );
    }, 20000);
    setStarting(true);
    stopReading();
    notify(
      "اسمح بالوصول إلى الميكروفون من المتصفح. اضغط الزر مرة أخرى لإلغاء الانتظار.",
    );
    try {
      const response = await fetch("/api/voice");
      const status = await response.json();
      if (!alive.current || micEpoch.current !== epoch) return;
      if (!status.transcribe)
        throw new Error(
          "التفريغ المحلي غير جاهز. شغّل npm run setup:voice مرة واحدة.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (!alive.current || micEpoch.current !== epoch) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      tracks.current = stream;
      clearTimeout(permissionTimer);
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.current = r;
      const chunks: BlobPart[] = [];
      const selected = language;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onerror = () => {
        r.onstop = null;
        if (r.state !== "inactive") r.stop();
        releaseMic();
        setRecording(false);
        notify("تعذر تسجيل الصوت. تحقق من الميكروفون.");
      };
      r.onstop = () => {
        releaseMic();
        setRecording(false);
        if (alive.current)
          void transcribe(
            new Blob(chunks, { type: r.mimeType || "audio/webm" }),
            selected,
          );
      };
      r.start(250);
      setRecording(true);
      notify("التسجيل يعمل — اضغط زر الميكروفون للإيقاف. الحد الأقصى دقيقة.");
      timer.current = setTimeout(() => {
        if (r.state === "recording") r.stop();
      }, 60000);
    } catch (e) {
      if (!alive.current || micEpoch.current !== epoch) return;
      releaseMic();
      const error = e as Error;
      notify(
        error.name === "NotAllowedError"
          ? "إذن الميكروفون مرفوض. اسمح به لهذا الموقع من المتصفح. يمكنك أيضًا استيراد تسجيل."
          : error.name === "NotFoundError"
            ? "لم يتم العثور على ميكروفون. وصّل ميكروفونًا أو استورد تسجيلًا."
            : error.message,
      );
    } finally {
      clearTimeout(permissionTimer);
      if (micEpoch.current === epoch) {
        micStarting.current = false;
        if (alive.current) setStarting(false);
      }
    }
  }

  async function readAloud(id: string, text: string) {
    if (reading === id) {
      stopReading();
      return;
    }
    stopReading();
    const current = ++requestId.current;
    const controller = new AbortController();
    ttsAbort.current = controller;
    setReading(id);
    setPreparing(true);
    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: isArabic(text) ? "ar" : "en" }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "تعذر إنشاء الصوت المحلي.",
        );
      const blob = await response.blob();
      if (
        !alive.current ||
        controller.signal.aborted ||
        requestId.current !== current
      )
        return;
      url.current = URL.createObjectURL(blob);
      setAudioUrl(url.current);
      setPreparing(false);
    } catch (e) {
      if (
        !controller.signal.aborted &&
        alive.current &&
        requestId.current === current
      ) {
        stopReading();
        notify((e as Error).message);
      }
    }
  }
  return {
    language,
    setLanguage,
    recording,
    transcribing,
    starting,
    toggleRecording,
    transcribe,
    readAloud,
    reading,
    preparing,
    audioUrl,
    player,
    stopReading,
    cancelInput,
  };
}
