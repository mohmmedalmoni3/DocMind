"""Conservative service routing only; contains no service answers or fees."""
import re
import unicodedata


def normalize(text):
    text = unicodedata.normalize('NFKC', text)
    text = re.sub('[\u064b-\u065f\u0670\u0640]', '', text)
    return text.translate(str.maketrans('أإآ', 'ااا'))


def explicit_services(question):
    q = normalize(question)
    families = [family for family, pattern in (
        ('passport', r'جواز|باسبور'), ('family_book', r'دفتر\s*(?:العائل[هة]|عائل[هة])'),
        ('id_card', r'البطاق[هة]|بطاق[هة]|الهوي[هة]|هوي[هة]')) if re.search(pattern, q)]
    kinds = [kind for kind, pattern in (
        ('renewal', r'تجديد|اجدد|يجدد|نجدد'), ('first_issue', r'لاول\s*مر[هة]|اول\s*مر[هة]'),
        ('lost', r'فاقد|فقدت|ضايع|ضاع|ضاعت'), ('damaged', r'تالف|تلف|اهتر[اى]')) if re.search(pattern, q)]
    # No cross-product guesses when several families/situations are mentioned.
    if len(families) != 1 or len(kinds) != 1:
        return None
    return [families[0] + '_' + kinds[0]]


def local_plan(question, history):
    q = normalize(question)
    # Clearly unrelated service domains with no in-scope document mention.
    # The committee model still generates the refusal/clarification at runtime.
    if not re.search(r'جواز|باسبور|دفتر|بطاق|هوي', q) and re.search(r'طيران|تذاكر|تذكر[هة]|تصديق|جامع[هة]|رخص[هة]|سيار[هة]', q):
        return {'services': [], 'fields': []}
    # Negated service changes and comparisons need semantic interpretation.
    if re.search(r'ليس|مش |مو |بدون |قارن|مقارن|ولا |اكثر|اغلى', q):
        return None
    parts = re.split(r'[,،]?\s+و(?=(?:قديش|كم|شو|ما|هل)\s)', q)
    part_services = [explicit_services(p) for p in parts]
    services = (list(dict.fromkeys(s for group in part_services for s in group))
                if len(parts) > 1 and all(part_services) else explicit_services(q))
    if not services:
        # Resolve only a short subject-free follow-up, from latest user turn.
        if re.search(r'جواز|باسبور|دفتر|بطاق|هوي', q):
            return None
        if len(q) > 180 or not re.match(r'^(?:و|كم|شو|هل|قديش|وين|متى|كيف)', q):
            return None
        previous = next((m['content'] for m in reversed(history) if m['role'] == 'user'), '')
        services = explicit_services(previous)
        if not services:
            return None
    fields = set()
    for index, pattern in (
        (0, r'مين|من يحق|الفئ[هة]|المستفيد'),
        (1, r'وين|اين|منين|سفار|قنصل|مكان|برا البلد|خارج|اقد.م|بقد.م'),
        (2, r'شروط|شرط|موافق|قاصر|زوج|يحق|بقدر|مسموح'),
        (3, r'اوراق|وثائق|صور[هة]|المطلوب|بلزمني|شهادة|مستند'),
        (4, r'خطوات|اجراء|كيف|شو بعمل'),
        (5, r'يستغرق|الوقت|المد[هة]|دقيق[هة]|كم يوم|قديش وقت'),
        (6, r'شركاء|جهات'), (7, r'ملاحظ|توفي|وفا[ةه]|رب الاسر[هة]|ابل.غ'),
        (8, r'رسوم|بدفع|بتكلف|تكلف|سعر|دينار|غرام|كفال|تعهد')):
        if re.search(pattern, q):
            fields.add(index)
    if not fields:
        return None
    # This determines evidence only. All answers still require the committee LLM.
    return {'services': services, 'fields': sorted(fields)}
