"""Bounded per-chat history, retaining the latest explicit service anchor."""
from routing import explicit_services,normalize
import re


def bounded_history(history,max_chars=5000,max_turns=8):
    selected=[];size=0
    for turn in reversed(history):
        cost=len(turn['content'])
        if len(selected)>=max_turns or size+cost>max_chars:break
        selected.insert(0,turn);size+=cost
    if history and not selected:
        raise ValueError('Latest dialogue turn exceeds history budget; not silently truncated')
    anchor=next((turn for turn in reversed(history) if turn['role']=='user'
                 and explicit_services(turn['content'])
                 and not re.search(r'(?<!\w)(?:مش|ليس|لا|مو)(?!\w)',normalize(turn['content']))),None)
    if anchor and not any(turn is anchor for turn in selected):
        if size+len(anchor['content'])>max_chars:
            raise ValueError('Service anchor exceeds dialogue budget; clarify/reset chat')
        selected.insert(0,anchor)
    return selected
