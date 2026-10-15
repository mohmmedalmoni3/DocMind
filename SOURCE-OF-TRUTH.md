# المرجع الأساسي للمشروع

المصدر الأساسي لمسار مسابقة الخدمات الحكومية هو الحزمة التي قدمها المستخدم: government-chatbot-codex-handoff.zip. حُفظت كاملة في competition-entry/docs/handoff، وجرى تطبيقها على مسار Python المستقل الموجود بدل استبدال المشروع بواجهة جديدة.

1. عند التعارض، قواعد challenge_brief.pdf الرسمية هي المرجع الأعلى. نسخة الحزمة مطابقة للنسخة السابقة ببصمة SHA-256: E70A2D64E8971355102BBB4B4C7E35EA54D69925D1C3C1D2509FDF73256039EE.
2. اسم نموذج اللجنة الذي حدده المستخدم: command-r7b-arabic:7b. يلزم OLLAMA_MODEL صريحًا في البيئة أو ملف الإعداد المحلي، ولا توجد بدائل صامتة.
3. 01_CODEX_PROMPT.md و02_REQUIREMENTS.md و04_ACCEPTANCE_CHECKLIST.md تحدد تنفيذنا وقبوله؛ 03_IMPLEMENTATION_PLAN.md و05_RUNBOOK_AR.md إرشاد هندسي وتشغيلي، وليس متطلبات إضافية اخترعتها اللجنة.
4. مصادر الإجابة الوحيدة ملفات الخدمات الاثنا عشر داخل competition-entry/data. الأمثلة والتوثيق والـPDF ليست قاعدة معرفة للمواطنين.
5. التعليمات الحالية في competition-entry/README-HANDOFF-AR.md وحالة الاختبار في competition-entry/HANDOFF-ACCEPTANCE-AR.md. تقرير RUN-RESULTS-AR.md تاريخي من الجولة السابقة، ولا يثبت نتائج أي نسخة أحدث.

واجهة Next.js تبقى واجهة عرض عامة. تسليم المسابقة هو `python main.py questions.json` من competition-entry. لا تستخدم اختصارات النقل المباشر أو replay الموجودة في واجهة العرض لإنتاج تسليم اللجنة.
