# حزمة تسليم المسابقة

التوثيق الأساسي الحالي: [README-HANDOFF-AR.md](README-HANDOFF-AR.md).
المواصفات الأصلية كاملة: [docs/handoff/00_START_HERE_AR.md](docs/handoff/00_START_HERE_AR.md).
حالة الاختبارات: [HANDOFF-ACCEPTANCE-AR.md](HANDOFF-ACCEPTANCE-AR.md).
شرح اللجنة: [JUDGES-WALKTHROUGH-AR.md](JUDGES-WALKTHROUGH-AR.md).

```powershell
$env:OLLAMA_MODEL='command-r7b-arabic:7b'
python doctor.py
python main.py questions.json
python verify_submission.py questions.json answers.json
```

الإعداد الموحد OLLAMA_MODEL يحل محل COMPETITION_MODEL. الملف المحلي .env يحدد اختيار المستخدم نفسه، و.env.example للمشاركة لا يختار نموذجًا بديلًا. لا تنزيل تلقائي ولا إجابات جاهزة.

[RUN-RESULTS-AR.md](RUN-RESULTS-AR.md) يوثّق النسخة السابقة، ويبقى سجلًا تاريخيًا؛ راجع تقرير القبول الحالي لنتائج تطبيق حزمة handoff. ملفات البيانات والتتبع والإجابات الخام محلية، وليست ضمن رفع الشفرة العام.
