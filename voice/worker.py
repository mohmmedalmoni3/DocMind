"""Local line-based worker. No listening port, cloud API, or retained recordings."""
import os
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["DO_NOT_TRACK"] = "1"
import base64
import io
import json
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "voice"
VOICES = {
    "ar": ROOT / "voices/ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx",
    "en": ROOT / "voices/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
}
_voices = {}
_whisper = None
def load_voice(lang):
    from piper import PiperVoice
    if lang not in _voices:
        _voices[lang] = PiperVoice.load(str(VOICES[lang]))
    return _voices[lang]
def load_whisper():
    global _whisper
    from faster_whisper import WhisperModel
    if _whisper is None:
        _whisper = WhisperModel(str(ROOT / "whisper-small"), device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    return _whisper

def run(request):
    if request["action"] == "warmup":
        load_voice("ar")
        load_voice("en")
        load_whisper()
        return {"ready": True}
    lang = request.get("language", "ar")
    if lang not in ("ar", "en", "auto"):
        raise ValueError("Unsupported language")
    if request["action"] == "speak":
        text = request.get("text", "").strip()
        if not text or len(text) > 8000:
            raise ValueError("Read-aloud text must be between 1 and 8000 characters")
        voice = load_voice(lang if lang != "auto" else "ar")
        output = io.BytesIO()
        with wave.open(output, "wb") as wav:
            voice.synthesize_wav(text, wav)
        return {"audio": base64.b64encode(output.getvalue()).decode("ascii")}
    if request["action"] == "transcribe":
        import numpy as np
        from faster_whisper.audio import decode_audio
        audio = base64.b64decode(request["audio"], validate=True)
        if len(audio) > 8 * 1024 * 1024:
            raise ValueError("Recording exceeds 8 MB")
        samples = decode_audio(io.BytesIO(audio), sampling_rate=16000)
        if len(samples) > 65 * 16000:
            raise ValueError("Recordings must be 60 seconds or less")
        if not len(samples) or float(np.max(np.abs(samples))) < 0.002:
            return {"text": "", "language": lang}
        model = load_whisper()
        segments, info = model.transcribe(samples, language=None if lang == "auto" else lang, beam_size=5,
                                          vad_filter=True, condition_on_previous_text=False)
        text = " ".join(s.text.strip() for s in segments if s.no_speech_prob < 0.7).strip()
        return {"text": text, "language": info.language}
    raise ValueError("Unsupported speech operation")

if __name__ == "__main__":
    for line in sys.stdin.buffer:
        try:
            if len(line) > 12 * 1024 * 1024:
                raise ValueError("Speech request too large")
            result = run(json.loads(line.decode("utf-8")))
        except Exception as error:
            result = {"error": str(error)}
        sys.stdout.buffer.write((json.dumps(result, ensure_ascii=False) + "\n").encode("utf-8"))
        sys.stdout.buffer.flush()
