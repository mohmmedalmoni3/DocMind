"""Local readiness only. Never pulls models or contacts non-loopback services."""
import hashlib
import json
import platform
from config import ROOT,settings
from corpus import load_corpus
from main import Ollama


def main():
    report={'python':platform.python_version(),'errors':[],'model_probe':'GET /api/tags only; generation not exercised'}
    try:
        sections,services,hashes=load_corpus(ROOT/'data')
        report.update(services=len(services),passages=len(sections),document_sha256=hashes,
                      corpus_fingerprint=hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest())
        config=settings()
        report.update(model=config.model,context=config.context,output_tokens=config.output,timeout_seconds=config.timeout)
        Ollama(config.model,config).preflight()
        report['model_installed']=True
    except Exception as error:
        report['errors'].append(str(error))
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return bool(report['errors'])


if __name__=='__main__':
    raise SystemExit(main())
