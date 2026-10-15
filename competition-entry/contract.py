"""Input preservation, output placement and atomic checkpoints."""
import copy
import json
import os
from pathlib import Path


def validate_input(document):
    if not isinstance(document,dict) or not isinstance(document.get('chats'),list):
        raise ValueError('Input must have a chats array')
    for c,chat in enumerate(document['chats']):
        if not isinstance(chat,dict) or 'chat_id' not in chat or not isinstance(chat.get('messages'),list):
            raise ValueError(f'Invalid chat at index {c}')
        for m,message in enumerate(chat['messages']):
            if not isinstance(message,dict) or 'message_id' not in message or not isinstance(message.get('question'),str):
                raise ValueError(f'Invalid message at chat {c}, index {m}')


def load_input(path):
    def invalid_constant(value):
        raise ValueError(f'Invalid JSON constant: {value}')
    document=json.loads(Path(path).read_text(encoding='utf-8-sig'),parse_constant=invalid_constant)
    validate_input(document)
    return document


def error_output(document):
    validate_input(document)
    result=copy.deepcopy(document)
    for chat in result['chats']:
        for message in chat['messages']:
            message.update(answer='error',contexts=[])
    return result


def output_path(input_path, root):
    source=Path(input_path).resolve()
    destination=(Path(root)/'answers.json').resolve()
    if source==destination or (source.exists() and destination.exists() and os.path.samefile(source,destination)):
        raise ValueError('Input/output collision: answers.json cannot be the questions input')
    return destination


def atomic_write(path, value):
    path=Path(path)
    temporary=path.with_name(path.name+'.tmp')
    with temporary.open('w',encoding='utf-8',newline='\n') as stream:
        json.dump(value,stream,ensure_ascii=False,indent=2,allow_nan=False)
        stream.flush()
        os.fsync(stream.fileno())
    temporary.replace(path)
