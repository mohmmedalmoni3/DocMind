import unittest
from fee_rules import branch_guidance,branch_problems,supported_totals,fee_output_schema,focused_fee_evidence
from grounding import digits


class FeeRules(unittest.TestCase):
    def test_base_and_additional_are_both_covered(self):
        source={'fake:8':'99 دينار لمن هم فوق سن 21 بيوم وجواز السفر منتهي او متبقي به اقل من (222) يوم',
                'fake:7':'يضاف 13 دينار في مكتب الخدمة المستعجلة'}
        plan=branch_guidance('عمري 23 وجوازي منتهي وكم الرسوم بالمستعجل؟',source)
        self.assertTrue(branch_problems('99 دينار',plan))
        self.assertTrue(branch_problems('13 دينار إضافية',plan))
        self.assertFalse(branch_problems('99 دينار ويضاف 13 دينار للمستعجل',plan))
        self.assertEqual(supported_totals(plan,['fake:8','fake:7']),{'112'})
        self.assertEqual(supported_totals(plan,['fake:8']),set())
        self.assertEqual(digits('خمسة وعشرون دينارا'),{'25'})
        schema=fee_output_schema(plan)
        self.assertEqual(schema['properties']['base']['minLength'],1)
        self.assertEqual(schema['properties']['additional']['minLength'],1)
        self.assertEqual(schema['properties']['used_ids']['minItems'],2)
        fragments={'fake:8#test':{'parent_id':'fake:8','quote':source['fake:8'],'text':source['fake:8']}}
        focused,analysis=focused_fee_evidence(source,plan,fragments)
        self.assertNotIn('fake:8',focused)
        self.assertIn('fake:8#test',focused)
        self.assertTrue(any(b['source_id']=='fake:8#test' for b in analysis['branches']))
    def test_thresholds_and_amounts_are_read_from_source(self):
        source={'fake:8':'99 دينار لمن هم فوق سن 21 بيوم وجواز السفر منتهي او متبقي به اقل من (222) يوم\n44 دينار لمن هم دون سن 21\n88 دينار لمن هم خارج البلاد'}
        plan=branch_guidance('عمري 23 وجوازي منتهي داخل الأردن',source)
        self.assertEqual([b['amount'] for b in plan['branches'] if b['status']=='supported'],['99'])
        self.assertTrue(branch_problems('الرسوم 44 دينار',plan))
        self.assertFalse(branch_problems('الرسوم 99 دينار',plan))
        self.assertFalse(branch_problems('44 دينار لمن هم دون السن المحدد',plan))

    def test_unknown_age_does_not_assume_applicability(self):
        plan=branch_guidance('كم الرسوم؟',{'fake:8':'44 دينار لمن هم دون سن 21'})
        self.assertEqual(plan['branches'][0]['status'],'unknown')

    def test_expired_and_unexpired_are_not_confused(self):
        source={'fake:8':'99 دينار لمن هم فوق سن 21 بيوم وجواز السفر منتهي او متبقي به اقل من (222) يوم\n88 دينار لجواز السفر غير المنتهي أو متبقي اكثر من 222 يوم على انتهاءه'}
        expired=branch_guidance('عمري 23 وجوازي منتهي',source)
        self.assertEqual([b['status'] for b in expired['branches']],['supported','excluded'])
        valid=branch_guidance('عمري 23 وجوازي غير منتهي باقي عليه 300 يوم',source)
        self.assertEqual([b['status'] for b in valid['branches']],['excluded','supported'])
