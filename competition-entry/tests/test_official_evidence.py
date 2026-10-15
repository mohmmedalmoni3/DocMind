"""Real corpus preservation/retrieval tests; NOT live factual answer evaluation."""
import unittest
from pathlib import Path
import main
from corpus import FILES,load_corpus,fee_fragments
from grounding import problems


@unittest.skipUnless(all((main.ROOT/'data'/f).exists() for f in FILES),'official corpus not supplied')
class OfficialEvidence(unittest.TestCase):
    def test_fee_fragment_offsets_point_to_exact_original_text(self):
        sections,_,_=load_corpus(main.ROOT/'data')
        fragments=fee_fragments(sections)
        self.assertTrue(fragments)
        for fragment in fragments.values():
            raw=Path(fragment['path']).read_bytes().decode('utf-8-sig')
            self.assertEqual(raw[fragment['char_start']:fragment['char_end']],fragment['quote'])
    def test_fee_notes_and_complete_lists_available_for_each_service(self):
        sections,services,_=load_corpus(main.ROOT/'data')
        class Recorder:
            def __init__(self,service):self.service=service;self.evidence={}
            def complete(self,system,payload,schema,*args):
                if 'evidence' not in payload:return {'services':[self.service],'fields':[8]}
                self.evidence=payload['evidence']
                return {'answer':'ناتج محاكاة للاختبار فقط','kind':'clarify','used_ids':[self.service+':8']}
        for service in services:
            client=Recorder(service)
            main.answer_question('استفسار رسوم في سياق اختبار',[],sections,services,client)
            for field in (2,3,7,8):self.assertIn(service+':'+str(field),client.evidence)
            self.assertEqual(client.evidence[service+':3'],sections[service+':3']['text'])

    def test_real_conditional_text_survives_without_automatic_rule_inference(self):
        sections,_,_=load_corpus(main.ROOT/'data')
        checks={
            'passport_renewal:8':['دون السادسة عشر','الممتلئ الصفحات','اقل من (180)','اكثر من 180','خارج البلاد'],
            'passport_renewal:7':['يضاف 25','المستعجلة'],
            'passport_lost:8':['125','250','اقل من 5 سنوات'],
            'family_book_lost:7':['للمرة الثانية','للمرة الثالثة','(50)'],
            'family_book_first_issue:8':['(90)','(10)'],
            'id_card_first_issue:8':['18','10'],
            'id_card_lost:7':['أسبوعين','للمرة الثالثة','(50)'],
        }
        for passage,fragments in checks.items():
            for fragment in fragments:self.assertIn(fragment,sections[passage]['text'])


if __name__=='__main__':unittest.main()
