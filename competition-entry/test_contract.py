import copy
import unittest
import main
from verify_submission import verify
from routing import local_plan


class ContractTests(unittest.TestCase):
    def test_conservative_local_routing_preserves_ambiguity_and_followup(self):
        self.assertEqual(local_plan('كم يستغرق تجديد دفتر العائلة؟', [])['services'], ['family_book_renewal'])
        self.assertIsNone(local_plan('بدي أجدد، شو المطلوب؟', []))
        compound = local_plan('قديش صورة للبطاقة لأول مرة وقديش لتجديد الجواز؟', [])
        self.assertEqual(compound['services'], ['id_card_first_issue', 'passport_renewal'])
        self.assertIn(3, compound['fields'])
        self.assertIsNone(local_plan('قارن جواز ودفتر العائلة لأول مرة وتجديد', []))
        self.assertIsNone(local_plan('مش تجديد جواز، بدل فاقد', []))
        history=[{'role':'user','content':'شو الأوراق المطلوبة لتجديد دفتر العائلة؟'}]
        self.assertEqual(local_plan('وبقدر أقدّم الطلب من السفارة إذا كنت برا البلد؟',history)['services'],['family_book_renewal'])
        self.assertIsNone(local_plan('وبقدر أقدّم من السفارة؟', []))
    def test_submission_checker_rejects_changed_question_and_invented_context(self):
        original = {'chats': [{'chat_id': '1', 'messages': [{'message_id': 'm', 'question': 'سؤال'}]}]}
        submitted = copy.deepcopy(original)
        submitted['chats'][0]['messages'][0].update(answer='جواب', contexts=['actual source'])
        self.assertEqual(verify(original, submitted, {'actual source'}), [])
        submitted['chats'][0]['messages'][0].update(question='changed', contexts=['invented'])
        self.assertEqual(len(verify(original, submitted, {'actual source'})), 2)

    @unittest.skipUnless((main.ROOT/'data'/'passport_renewal.txt').exists(),'official corpus required')
    def test_fields_and_unmodified_conditions(self):
        sections, services, _ = main.load_corpus(main.ROOT / 'data')
        self.assertEqual(len(services), 12)
        self.assertEqual(len(sections), 108)
        self.assertIn('180', sections['passport_renewal:8']['text'])
        self.assertIn('25', sections['passport_renewal:7']['text'])
        self.assertIn('عدد (1)', sections['id_card_first_issue:3']['text'])

    def test_order_memory_and_error_isolation(self):
        document = {'metadata': 'keep', 'chats': [
            {'chat_id': 'a', 'messages': [{'message_id': str(i), 'question': str(i), 'extra': 4} for i in range(3)]},
            {'chat_id': 'b', 'messages': [{'message_id': 'x', 'question': 'x'}]}]}
        old = copy.deepcopy(document)
        histories = []
        original = main.answer_question
        def fake(question, history, *args):
            histories.append(copy.deepcopy(history))
            if question == '1':
                raise ValueError('simulated error')
            return 'generated test response', ['source']
        main.answer_question = fake
        try:
            output, timings = main.run(document, {}, {}, None)
        finally:
            main.answer_question = original
        self.assertEqual(document, old)
        self.assertEqual(output['metadata'], 'keep')
        self.assertEqual(output['chats'][0]['messages'][1]['answer'], 'error')
        self.assertEqual(output['chats'][0]['messages'][2]['extra'], 4)
        self.assertEqual(histories[0], [])
        self.assertTrue(histories[1])
        self.assertEqual(histories[3], [])
        self.assertEqual(len(timings), 4)

    @unittest.skipUnless((main.ROOT/'data'/'passport_renewal.txt').exists(),'official corpus required')
    def test_answer_comes_from_model_and_context_is_exact_section(self):
        sections, services, _ = main.load_corpus(main.ROOT / 'data')
        class Fake:
            calls = 0
            def complete(self, system, payload, schema, tokens=900):
                self.calls += 1
                if self.calls == 1:
                    return {'services': ['family_book_renewal'], 'fields': [5]}
                return {'answer': 'نص مولد للاختبار', 'kind': 'answer', 'used_ids': ['family_book_renewal:5']}
        client = Fake()
        answer, contexts = main.answer_question('سؤال', [], sections, services, client)
        self.assertEqual(client.calls, 2)
        self.assertEqual(answer, 'نص مولد للاختبار')
        self.assertEqual(contexts, [sections['family_book_renewal:5']['text']])


if __name__ == '__main__':
    unittest.main()
