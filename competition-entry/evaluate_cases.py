"""Development evaluation using the production engine; never used as answer lookup."""
import json
from pathlib import Path
import sys
from config import settings,ROOT
from corpus import load_corpus
from contract import validate_input,atomic_write
from main import Ollama,run


if __name__=='__main__':
    if len(sys.argv)!=3:
        raise SystemExit('python evaluate_cases.py cases.json report.json')
    document=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
    validate_input(document)
    config=settings();client=Ollama(config.model,config);client.preflight()
    sections,services,hashes=load_corpus(ROOT/'data')
    output,timings=run(document,sections,services,client)
    atomic_write(Path(sys.argv[2]),{'model':client.model,'output':output,'timings':timings,'calls':client.metrics,'hashes':hashes})
