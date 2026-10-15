"""Local configuration; never installs, downloads, or chooses a fallback model."""
from dataclasses import dataclass
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
for stream in (sys.stdout,sys.stderr):
    if hasattr(stream,'reconfigure'):
        stream.reconfigure(encoding='utf-8',errors='backslashreplace')
APPROVED_MODEL = 'command-r7b-arabic:7b'


def load_local_env():
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if not line.strip() or line.lstrip().startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            if key.strip().startswith('OLLAMA_'):
                os.environ.setdefault(key.strip(), value.strip().strip('"\''))


def number(name, default, minimum, maximum):
    value = int(os.environ.get(name, default))
    if not minimum <= value <= maximum:
        raise ValueError(f'{name} must be {minimum}..{maximum}')
    return value


@dataclass(frozen=True)
class Settings:
    model: str
    url: str
    context: int
    output: int
    timeout: int
    max_prompt_chars: int
    circuit_failures: int
    trace: bool = False


def settings():
    load_local_env()
    model = os.environ.get('OLLAMA_MODEL', '').strip()
    if not model:
        raise ValueError('OLLAMA_MODEL is required; set it to the exact approved committee tag')
    if model != APPROVED_MODEL:
        raise ValueError(f'Approved model is {APPROVED_MODEL}; refusing substitution')
    url = os.environ.get('OLLAMA_BASE_URL', 'http://127.0.0.1:11434').rstrip('/')
    parsed = urlparse(url)
    if parsed.scheme != 'http' or parsed.hostname not in ('127.0.0.1', 'localhost', '::1') or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
        raise ValueError('OLLAMA_BASE_URL must be an HTTP loopback origin')
    return Settings(model, url, number('OLLAMA_CONTEXT_SIZE',16384,4096,32768),
                    number('OLLAMA_OUTPUT_TOKENS',900,128,2000), number('OLLAMA_TIMEOUT_SECONDS',180,1,600),
                    number('OLLAMA_MAX_PROMPT_CHARS',24000,1000,48000), number('OLLAMA_CIRCUIT_FAILURES',2,1,5),
                    os.environ.get('OLLAMA_TRACE','false').lower()=='true')
