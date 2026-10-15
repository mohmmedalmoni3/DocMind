"""Lossless source inventory, structural passages and raw byte/line provenance."""
import hashlib
from pathlib import Path
import re

FIELDS = ['الفئة المستفيدة','أماكن تقديم الخدمة','شروط تقديم الخدمة','الوثائق المطلوبة للحصول على الخدمة',
          'إجراءات تقديم الخدمة','الزمن المستغرق لتقديم الخدمة','شركاء الخدمة','ملاحظات','الرسوم']
FILES = [f'{family}_{kind}.txt' for family in ('passport','family_book','id_card')
         for kind in ('first_issue','renewal','lost','damaged')]


def load_corpus(folder):
    sections, services, hashes = {}, {}, {}
    for name in FILES:
        path = Path(folder) / name
        raw_bytes = path.read_bytes()
        hashes[name] = hashlib.sha256(raw_bytes).hexdigest()
        text = raw_bytes.decode('utf-8-sig')
        matches = list(re.finditer(r'(?m)^[ \t]*('+'|'.join(map(re.escape,FIELDS))+r')(?=\s|$)',text))
        found = [m.group(1) for m in matches]
        if len(found)!=9 or set(found)!=set(FIELDS):
            raise ValueError(f'{name}: expected all nine unique fields, got {found}')
        headings = [x.strip() for x in text[:matches[0].start()].splitlines()
                    if x.strip() and x.strip() not in ('الرئيسية','الخدمات','دليل الخدمات','شارك')]
        if not headings:
            raise ValueError(f'{name}: missing source service title')
        title = headings[-1]
        service = path.stem
        services[service] = title
        for i, match in enumerate(matches):
            field = match.group(1)
            start, end = match.start(), matches[i+1].start() if i+1<len(matches) else len(text)
            raw_passage = text[start:end].strip()
            if not text[match.end():end].strip():
                raise ValueError(f'{name}: empty {field}')
            key = f'{service}:{FIELDS.index(field)}'
            # Source title repeated for disambiguation; body/conditions never paraphrased.
            sections[key] = {'service':service,'field':field,'text':title+'\n'+raw_passage,
                'path':str(path.resolve()),'source_sha256':hashes[name],
                'char_start':start,'char_end':end,'line_start':text.count('\n',0,start)+1,
                'line_end':text.count('\n',0,end)+1,'raw_passage':raw_passage,
                'strip_offset':len(text[start:end])-len(text[start:end].lstrip())}
    return sections, services, hashes


def fee_fragments(sections):
    fragments={}
    for key,section in sections.items():
        if not key.endswith(':8'):continue
        title=section['text'].split('\n',1)[0]
        for line in section['raw_passage'].splitlines():
            quote=line.strip()
            if not re.match(r'(?:الرسوم\s*)?\(?\s*[0-9٠-٩۰-۹]+\s*دينار',quote):continue
            identifier=key+'#'+hashlib.sha256(quote.encode('utf-8')).hexdigest()[:12]
            offset=section['raw_passage'].index(quote)
            start=section['char_start']+section['strip_offset']+offset
            line_start=section['line_start']+section['raw_passage'][:offset].count('\n')
            fragments[identifier]={**section,'parent_id':key,'text':title+'\n'+quote,'quote':quote,
                'char_start':start,'char_end':start+len(quote),'line_start':line_start,'line_end':line_start,
                'raw_passage':quote,'strip_offset':0}
    return fragments
