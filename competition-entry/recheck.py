"""Developer-only targeted rerun. Main submission always generates every answer afresh."""
import json
from pathlib import Path
import sys
import time
from main import ROOT, COMMITTEE_MODEL, Ollama, load_corpus, answer_question


def main():
    ids = set(sys.argv[1:])
    if not ids:
        raise SystemExit('python recheck.py message-id [...]')
    output = json.loads((ROOT / 'answers.json').read_text(encoding='utf-8'))
    report = json.loads((ROOT / 'run-report.json').read_text(encoding='utf-8'))
    sections, services, _ = load_corpus(ROOT / 'data')
    client = Ollama(COMMITTEE_MODEL)
    for chat in output['chats']:
        history = []
        for message in chat['messages']:
            if message['message_id'] in ids:
                start = time.monotonic()
                answer, contexts = answer_question(message['question'], history, sections, services, client)
                message.update(answer=answer, contexts=contexts)
                report.setdefault('targeted_rechecks', []).append({'message_id': message['message_id'], 'seconds': round(time.monotonic()-start, 3)})
            history.extend([{'role':'user','content':message['question']}, {'role':'assistant','content':message['answer']}])
    report['model_calls'] += client.calls
    report['calls'].extend(client.metrics)
    (ROOT / 'answers.json').write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'run-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
