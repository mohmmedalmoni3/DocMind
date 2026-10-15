"""Source-derived branch hints. No fee amounts or service thresholds are stored here."""
import re
from grounding import digits
from routing import normalize


def branch_guidance(question,evidence):
    q=normalize(question)
    age_match=re.search(r'عمري\s*([0-9٠-٩۰-۹]+)',q)
    age=int(next(iter(digits(age_match.group(1))))) if age_match else None
    expired=False if re.search(r'غير\s+منتهي|مش\s+منتهي|ساري',q) else True if 'منتهي' in q else None
    abroad=True if re.search(r'خارج\s+(?:الاردن|البلاد|المملك[هة])|برا\s+(?:البلد|الاردن)',q) else False if re.search(r'داخل\s+(?:الاردن|البلاد|المملك[هة])',q) else None
    military=False if re.search(r'(?<!\w)مدني(?!\w)|(?:مش|لست|غير)\s+عسكري',q) else True if re.search(r'(?<!\w)عسكري(?!\w)|قوات\s+حفظ\s+السلام',q) else None
    remaining=re.search(r'(?:باقي|متبقي)(?:\s+عليه|\s+به)?\s*([0-9٠-٩۰-۹]+)\s*(يوم|شهر|شهور|اشهر)',q)
    interval=None
    if remaining:
        value=int(next(iter(digits(remaining.group(1)))))
        interval=(value,value) if remaining.group(2)=='يوم' else (value*28,value*31)
    branches=[]
    for key,text in evidence.items():
        if key.endswith(':7'):
            for line in text.splitlines():
                extra=re.search(r'يضاف\s+([0-9٠-٩۰-۹]+)\s+دينار',normalize(line))
                if extra:
                    status='supported' if 'المستعجلة' in normalize(line) and 'مستعجل' in q else 'unknown'
                    branches.append({'source_id':key,'quote':line.strip(),'amount':next(iter(digits(extra.group(1)))),'status':status,'kind':'additional'})
        if not key.endswith(':8'):continue
        for line in text.splitlines():
            original=line.strip();clean=normalize(original)
            match=re.match(r'(?:الرسوم\s*)?\(?\s*([0-9٠-٩۰-۹]+)\s*دينار',clean)
            if not match:continue
            amount=next(iter(digits(match.group(1))))
            predicates=[]
            if re.search(r'قوات|عسكري|اجهز[هة]\s+امني[هة]|حفظ\s+السلام',clean):
                predicates.append(military)
                if 'تغيير' in clean and military is False:predicates[-1]=None
            if 'الممتلئ الصفحات' in clean:
                predicates.extend([True if re.search(r'ممتلئ|مليان|امتل[اأ]',q) else None,
                                   None if expired is None else not expired])
            under=re.search(r'دون\s+(?:سن\s+)?(.+)$',clean)
            if under:
                values=digits(under.group(1));threshold=max(map(int,values)) if values else None
                predicates.append(age<threshold if age is not None and threshold else None)
            above=re.search(r'فوق\s+سن\s+(.+?)\s+بيوم',clean)
            if above:
                values=digits(above.group(1));threshold=max(map(int,values)) if values else None
                predicates.append(age>threshold if age is not None and threshold else None)
            days=re.search(r'(اقل|اكثر)\s+من\s*\(?\s*(\d+)\)?\s*يوم',clean)
            if days:
                boundary=int(days.group(2));condition=None
                if interval:
                    if days.group(1)=='اقل':condition=True if interval[1]<boundary else False if interval[0]>=boundary else None
                    else:condition=True if interval[0]>boundary else False if interval[1]<=boundary else None
                if 'منتهي او' in clean and expired is True:condition=True
                if ('غير المنتهي' in clean or 'اكثر' in days.group(1)) and expired is True:condition=False
                predicates.append(condition)
            if 'خارج البلاد' in clean:predicates.append(abroad)
            elif 'داخل البلاد' in clean:predicates.append(None if abroad is None else not abroad)
            # Unrecognized conditional language cannot become an unconditional default.
            if not predicates and re.search(r'لمن|حالة|اذا|سنوات|للمرة',clean):predicates.append(None)
            status='excluded' if False in predicates else 'unknown' if None in predicates else 'supported'
            branches.append({'source_id':key,'quote':original,'amount':amount,'status':status})
    return {'branches':branches,'requires_base':bool(re.search(r'رسوم|بدفع|بتكلف|تكلف[هة]|سعر|مجموع',q)),
            'warning':'Apply only supported branches; cover requested base fee AND applicable additional charges separately. Do not turn unknown special cases into a default. This helper is incomplete; use source predicates and clarify ambiguity.'}


def branch_problems(answer,guidance):
    supported={b['amount'] for b in guidance['branches'] if b['status']=='supported'}
    if not supported:return []
    values=digits(answer)
    extras={b['amount'] for b in guidance['branches'] if b['status']=='supported' and b.get('kind')=='additional'}
    bases={b['amount'] for b in guidance['branches'] if b['status']=='supported' and b.get('kind')!='additional'}
    if extras-values:return ['Missing applicable additional charge from source: '+', '.join(extras-values)]
    if guidance.get('requires_base') and bases and not bases&values:
        return ['Missing requested base fee from supported source branch']
    disallowed={b['amount'] for b in guidance['branches'] if b['status']!='supported'}-supported
    for clause in re.split(r'[.،؛\n]',answer):
        # Explicit alternatives/negations may legitimately mention excluded values.
        if re.search(r'اذا|إذا|إن |ليس|ليست|لا |لمن',clause):continue
        for amount in re.findall(r'([^\s]+)\s+دينار',clause):
            if digits(amount)&disallowed:
                return ['An asserted fee comes from an excluded/unknown branch; apply source conditions or clarify']
    return []


def supported_totals(guidance,used_ids):
    """Only an unambiguous supported base plus explicitly additive supported notes."""
    relevant=[b for b in guidance['branches'] if b['status']=='supported' and b['source_id'] in used_ids]
    bases={int(b['amount']) for b in relevant if b.get('kind')!='additional'}
    extras={int(b['amount']) for b in relevant if b.get('kind')=='additional'}
    return {str(next(iter(bases))+sum(extras))} if len(bases)==1 and extras else set()


def fee_output_schema(guidance):
    bases={b['amount'] for b in guidance['branches'] if b['status']=='supported' and b.get('kind')!='additional'}
    extras={b['amount'] for b in guidance['branches'] if b['status']=='supported' and b.get('kind')=='additional'}
    if len(bases)!=1 or len(extras)!=1:return None
    ids=sorted({b['source_id'] for b in guidance['branches'] if b['status']=='supported'})
    # Runtime source-derived numeric constraints, not stored factual answers.
    return {'type':'object','additionalProperties':False,'required':['base','additional','used_ids','kind'],
            'properties':{'base':{'type':'string','minLength':1},
                          'additional':{'type':'string','minLength':1},
                          'used_ids':{'type':'array','items':{'type':'string','enum':ids},'minItems':len(ids),'maxItems':len(ids),'uniqueItems':True},
                          'kind':{'type':'string','enum':['answer','clarify']}}}


def focused_fee_evidence(evidence,guidance,fragments):
    # Narrow only the supported simple branch+additional case; preserve full
    # sections whenever applicability is ambiguous or the parser is incomplete.
    if not fee_output_schema(guidance):return evidence,guidance
    selected=[b for b in guidance['branches'] if b['status']=='supported' and b.get('kind')!='additional']
    if len(selected)!=1:return evidence,guidance
    branch=selected[0]
    found=next(((key,value) for key,value in fragments.items()
                if value['parent_id']==branch['source_id'] and value['quote']==branch['quote']),None)
    if not found:return evidence,guidance
    key,fragment=found
    focused={k:v for k,v in evidence.items() if k!=branch['source_id']}
    focused[key]=fragment['text']
    adjusted={**guidance,'branches':[{**b,'source_id':key} if b is branch else b for b in guidance['branches']]}
    return focused,adjusted
