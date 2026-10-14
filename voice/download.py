"""One-time setup only. Runtime worker never downloads models or sends audio online."""
from pathlib import Path
from huggingface_hub import snapshot_download, hf_hub_download

root = Path(__file__).resolve().parents[1] / "data" / "voice"
root.mkdir(parents=True, exist_ok=True)
print("Downloading multilingual Whisper small for local transcription...", flush=True)
snapshot_download("Systran/faster-whisper-small", local_dir=root / "whisper-small",
                  allow_patterns=["config.json", "model.bin", "tokenizer.json", "vocabulary.*", "preprocessor_config.json"])
for lang, name in [("ar/ar_JO/kareem/medium", "ar_JO-kareem-medium"), ("en/en_US/lessac/medium", "en_US-lessac-medium")]:
    for suffix in [".onnx", ".onnx.json"]:
        source = hf_hub_download("rhasspy/piper-voices", filename=f"{lang}/{name}{suffix}", local_dir=root / "voices")
        print(f"Ready: {Path(source).name}", flush=True)
    hf_hub_download("rhasspy/piper-voices", filename=f"{lang}/MODEL_CARD", local_dir=root / "voices")
print("Offline speech is ready.", flush=True)
