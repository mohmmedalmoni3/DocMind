"""Necessary grounding checks, not a proof of semantic entailment."""
import re
import unicodedata


def digits(text):
    text=''.join(str(unicodedata.digit(c)) if c.isdecimal() else c for c in text)
    found=set(re.findall(r'\d+(?:[.٫,]\d+)*',text))
    # Language-only numeric equivalence, never service-specific values/rules.
    normalized=re.sub('[\u064b-\u065f\u0670\u0640]','',text).replace('أ','ا').replace('إ','ا')
    ones={'واحد':1,'احد':1,'اثنان':2,'اثنين':2,'اثنتان':2,'اثنتين':2,'ثلاثة':3,'ثلاث':3,'اربعة':4,'اربع':4,
          'خمسة':5,'خمس':5,'ستة':6,'ست':6,'سبعة':7,'سبع':7,'ثمانية':8,'ثماني':8,'تسعة':9,'تسع':9}
    tens={'عشرون':20,'عشرين':20,'ثلاثون':30,'ثلاثين':30,'اربعون':40,'اربعين':40,'خمسون':50,'خمسين':50,
          'ستون':60,'ستين':60,'سبعون':70,'سبعين':70,'ثمانون':80,'ثمانين':80,'تسعون':90,'تسعين':90}
    combined=r'(?<!\w)('+'|'.join(ones)+r')\s*و\s*('+'|'.join(tens)+r')(?!\w)'
    def collect(match):
        found.add(str(ones[match.group(1)]+tens[match.group(2)]));return ' '
    normalized=re.sub(combined,collect,normalized)
    aliases={1:r'واحد[هة]?|الاولى|الاول',2:r'اثنان|اثنين|اثنتان|اثنتين|الثاني[هة]|دينارين|ديناران|صورتين|صورتان',
             3:r'ثلاث[هة]?|الثالث[هة]',4:r'اربع[هة]?',5:r'خمس[هة]?',6:r'ست[هة]?',7:r'سبع[هة]?',
             8:r'ثماني[هة]?',9:r'تسع[هة]?',10:r'عشر[هة]?',16:r'السادس[هة]\s+عشر[هة]?|ست[هة]\s+عشر[هة]?',
             18:r'الثامن[هة]\s+عشر[هة]?|ثماني[هة]\s+عشر[هة]?',20:r'عشرين|عشرون',30:r'ثلاثين|ثلاثون',
             50:r'خمسين|خمسون',90:r'تسعين|تسعون',100:r'مئ[هة]|مائ[هة]'}
    for value,pattern in aliases.items():
        if re.search(r'(?<!\w)(?:و)?(?:ال)?(?:'+pattern+r')(?!\w)',normalized):found.add(str(value))
    return found


def problems(result,evidence,question,derived_numbers=()):
    if not isinstance(result,dict) or not isinstance(result.get('answer'),str) or not result['answer'].strip():
        return ['missing answer']
    used=result.get('used_ids')
    if not isinstance(used,list) or any(not isinstance(i,str) or i not in evidence for i in used):
        return ['invalid evidence IDs']
    if result.get('kind') not in ('answer','clarify','not_found'):
        return ['invalid kind']
    if result['kind']=='answer' and not used:
        return ['factual answer without evidence']
    if not evidence and (used or result['kind']=='answer'):
        return ['no supporting evidence']
    answer=result['answer']
    if re.search(r'\[(?:numer|source|citation)\s*\d+\]',answer,re.I):
        return ['malformed model artifact']
    supported='\n'.join(evidence[i] for i in used)
    allowed=digits(supported)|digits(question)|set(derived_numbers)
    missing=digits(answer)-allowed
    # Arithmetic not literally present is repaired into supported branches instead.
    if missing:
        return ['unsupported numerical value(s): '+', '.join(sorted(missing))]
    if any(m.group() not in supported for m in re.finditer(r'[\u3400-\u9fff]+',answer)):
        return ['unexpected foreign-script output']
    return []
