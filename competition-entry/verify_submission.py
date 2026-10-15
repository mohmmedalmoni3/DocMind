"""Validate format/provenance only, never claim semantic correctness."""
import json
from pathlib import Path
import sys
from main import ROOT, load_corpus
from corpus import fee_fragments

def same_value(left,right):
    if type(left) is not type(right):return False
    if isinstance(left,dict):return left.keys()==right.keys() and all(same_value(left[k],right[k]) for k in left)
    if isinstance(left,list):return len(left)==len(right) and all(same_value(a,b) for a,b in zip(left,right))
    return left==right


def verify(original, submitted, allowed_contexts):
    errors = []
    if not isinstance(submitted, dict) or not isinstance(submitted.get('chats'), list):
        return ['Missing chats array']
    for key, value in original.items():
        if key != 'chats' and not same_value(submitted.get(key),value):
            errors.append(f'Changed top-level field {key}')
    if len(submitted['chats']) != len(original['chats']):
        errors.append('Chat count changed')
    for index, (before, after) in enumerate(zip(original['chats'], submitted['chats'])):
        if not isinstance(after,dict):
            errors.append(f'Chat {index}: not an object');continue
        for key, value in before.items():
            if key != 'messages' and not same_value(after.get(key),value):
                errors.append(f'Chat {index}: changed {key}')
        if not isinstance(after.get('messages'),list):
            errors.append(f'Chat {index}: missing messages array');continue
        if len(after['messages']) != len(before['messages']):
            errors.append(f'Chat {index}: message count changed')
        for old, new in zip(before['messages'], after.get('messages', [])):
            label = old.get('message_id', '?')
            if not isinstance(new,dict):
                errors.append(f'{label}: not an object');continue
            if any(not same_value(new.get(k),v) for k, v in old.items() if k not in ('answer', 'contexts')):
                errors.append(f'{label}: original content changed')
            if not isinstance(new.get('answer'), str) or not new['answer'].strip():
                errors.append(f'{label}: missing answer')
            if new.get('answer') == 'error':
                errors.append(f'{label}: generation failed')
            contexts = new.get('contexts')
            if not isinstance(contexts, list) or any(not isinstance(c, str) or c not in allowed_contexts for c in contexts):
                errors.append(f'{label}: context not an exact indexed passage')
    return errors


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('python verify_submission.py questions.json answers.json')
    sections, _, _ = load_corpus(ROOT / 'data')
    errors = verify(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig')),
                    json.loads(Path(sys.argv[2]).read_text(encoding='utf-8-sig')),
                    {s['text'] for s in [*sections.values(),*fee_fragments(sections).values()]})
    print(json.dumps({'format_and_provenance_errors': errors,
                      'semantic_accuracy': 'requires reference and human review'}, ensure_ascii=False, indent=2))
    raise SystemExit(bool(errors))
