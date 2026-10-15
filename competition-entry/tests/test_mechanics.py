import copy
import json
import os
from pathlib import Path
import tempfile
import subprocess
import shutil
import sys
import unittest
from unittest.mock import patch
import urllib.error
import main
from config import Settings,APPROVED_MODEL,settings
from contract import validate_input,error_output,output_path,atomic_write
from corpus import FILES,load_corpus
from grounding import problems
from routing import explicit_services,local_plan
from verify_submission import same_value
from dialogue import bounded_history

TEST_TEMP=(Path(__file__).resolve().parent/'.tmp').resolve()
TEST_TEMP.mkdir(exist_ok=True)
tempfile.tempdir=str(TEST_TEMP)


class Mechanics(unittest.TestCase):
    def test_history_bounds_keep_anchor_and_negation_is_not_borrowed(self):
        anchor={'role':'user','content':'كم رسوم تجديد جواز السفر؟'}
        history=[anchor]+[{'role':'assistant','content':'رد قصير'} for _ in range(15)]
        selected=bounded_history(history)
        self.assertIs(selected[0],anchor)
        self.assertLessEqual(len(selected),9)
        self.assertIsNone(local_plan('كم الرسوم؟',[{'role':'user','content':'مش بدي تجديد جواز السفر'}]))
        with self.assertRaises(ValueError):bounded_history([{'role':'user','content':'x'*6000}])
    def test_metadata_types_are_not_coerced_by_verifier(self):
        self.assertFalse(same_value({'flag':True},{'flag':1}))
        self.assertFalse(same_value([1],[1.0]))
        self.assertTrue(same_value({'a':[None,'عربي',False]},{'a':[None,'عربي',False]}))
    def test_real_cli_from_other_directory_and_collision(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);submission=root/'submission';submission.mkdir()
            for name in ('main.py','config.py','contract.py','corpus.py','routing.py','grounding.py','fee_rules.py','dialogue.py'):
                shutil.copyfile(main.ROOT/name,submission/name)
            source=root/'input.json';value={'metadata':['عربي',False],'chats':[{'chat_id':9,'messages':[]}]}
            source.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8')
            command=[sys.executable,str(submission/'main.py'),str(source)]
            result=subprocess.run(command,cwd=root,capture_output=True,timeout=10)
            self.assertEqual(result.returncode,0,result.stderr)
            destination=submission/'answers.json'
            self.assertEqual(json.loads(destination.read_text(encoding='utf-8')),value)
            before=destination.read_bytes()
            result=subprocess.run([sys.executable,str(submission/'main.py'),str(destination)],cwd=root,capture_output=True,timeout=10)
            self.assertEqual(result.returncode,2)
            self.assertEqual(destination.read_bytes(),before)

    def test_empty_and_metadata_and_nonstring_ids(self):
        value={'meta':{'flag':False},'chats':[{'chat_id':12,'tags':None,'messages':[]}]}
        self.assertEqual(error_output(value),value)
        self.assertEqual(main.run(value,{}, {},None)[0],value)
        validate_input({'chats':[]})
        for bad in ({'chats':{}},{'chats':[{}]},{'chats':[{'chat_id':'x','messages':[{'message_id':3,'question':None}]}]}):
            with self.assertRaises(ValueError):validate_input(bad)

    def test_collision_atomic_utf8_and_path(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);dest=root/'answers.json'
            atomic_write(dest,{'نص':'عربي'})
            before=dest.read_bytes()
            with self.assertRaises(ValueError):output_path(dest,root)
            self.assertEqual(dest.read_bytes(),before)
            self.assertIn('عربي',dest.read_text(encoding='utf-8'))
            self.assertFalse((root/'answers.json.tmp').exists())
            self.assertEqual(output_path(root/'other.json',root),dest)

    def test_source_bytes_and_provenance_and_missing_field(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            fixture=(Path(__file__).parent/'fixtures/service.txt').read_bytes()
            for name in FILES:(root/name).write_bytes(fixture)
            sections,services,hashes=load_corpus(root)
            self.assertEqual(len(sections),108)
            passage=sections['passport_lost:8']
            text=(root/'passport_lost.txt').read_bytes().decode('utf-8-sig')
            self.assertEqual(text[passage['char_start']:passage['char_end']].strip(),passage['raw_passage'])
            self.assertIn('خارجها',passage['text'])
            for name in FILES:self.assertEqual((root/name).read_bytes(),fixture)
            (root/FILES[0]).write_text('missing fields',encoding='utf-8')
            with self.assertRaises(ValueError):load_corpus(root)

    def test_all_twelve_service_routes_and_collisions(self):
        for family,label in [('passport','جواز السفر'),('family_book','دفتر العائلة'),('id_card','البطاقة الذكية')]:
            for kind,modifier in [('first_issue','لأول مرة'),('renewal','تجديد'),('lost','بدل فاقد'),('damaged','بدل تالف')]:
                self.assertEqual(explicit_services(f'كم رسوم {modifier} {label}؟'),[family+'_'+kind])
        self.assertEqual(explicit_services('شو بلزمني جوازي بدل تالف؟'),['passport_damaged'])
        self.assertIsNone(explicit_services('تجديد بطاقة البنك'))
        self.assertIsNone(explicit_services('جوازاتيون تجديد'))
        self.assertIsNone(local_plan('قصدي تجديد الجواز مش دفتر العائلة',[]))
        self.assertIsNone(local_plan('كم بدفع؟',[]))

    def test_numeric_support_repairs_invention_and_preserves_original_digits(self):
        evidence={'a':'رسوم الاختبار ١١ وحدة ومدة المعالجة ٧ دقائق، يضاف ٣ وحدات بشرط.'}
        good={'answer':'الرسوم 11 وحدة والمدة ٧ دقائق.','used_ids':['a'],'kind':'answer'}
        self.assertEqual(problems(good,evidence,'كم الرسوم؟'),[])
        bad={**good,'answer':'الرسوم 999 وحدة'}
        self.assertTrue(problems(bad,evidence,'كم الرسوم؟'))
        self.assertTrue(problems({**good,'used_ids':['invented']},evidence,''))
        self.assertTrue(problems({**good,'answer':'[numer1] 答案'},evidence,''))
        self.assertEqual(problems({'answer':'لم أجد معلومات.','used_ids':[],'kind':'not_found'}, {}, ''),[])
        self.assertEqual(problems({'answer':'2 دينار عند الانتهاء و3 عند عدم الانتهاء.','used_ids':['a'],'kind':'answer'},
                                  {'a':'دينارين للمنتهي وثلاثة دنانير لغير المنتهي.'},''),[])

    def test_bounded_repair_does_not_accept_invalid_source_ids(self):
        sections={'x:8':{'service':'x','text':'اختبار 11 وحدة'}}
        class Fake:
            calls=0
            def complete(self,*args):
                self.calls+=1
                if self.calls==1:return {'services':['x'],'fields':[8]}
                return {'answer':'999 وحدة','used_ids':['x:8'],'kind':'answer'}
        client=Fake()
        with self.assertRaises(ValueError):main.answer_question('استفسار',[],sections,{'x':'خدمة اختبار'},client)
        self.assertEqual(client.calls,3)

    def test_circuit_breaker_stops_repeated_network_waits(self):
        document={'chats':[{'chat_id':1,'messages':[{'message_id':i,'question':'سؤال'} for i in range(8)]}]}
        with patch.object(main,'answer_question',side_effect=urllib.error.URLError('offline')) as inference:
            output,timings=main.run(document,{}, {},None)
        self.assertEqual(inference.call_count,2)
        self.assertTrue(all(m['answer']=='error' for m in output['chats'][0]['messages']))
        self.assertEqual(len(timings),8)

    def test_required_model_and_local_endpoint(self):
        with patch('config.load_local_env'),patch.dict(os.environ,{},clear=True):
            with self.assertRaises(ValueError):settings()
        with patch('config.load_local_env'),patch.dict(os.environ,{'OLLAMA_MODEL':APPROVED_MODEL,'OLLAMA_BASE_URL':'https://external.example'},clear=True):
            with self.assertRaises(ValueError):settings()

    def test_output_truncation_rejected(self):
        conf=Settings(APPROVED_MODEL,'http://127.0.0.1:11434',4096,256,1,4096,2)
        client=main.Ollama(APPROVED_MODEL,conf)
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self):return json.dumps({'model':APPROVED_MODEL,'done_reason':'length','message':{'content':'{}'}}).encode()
        with tempfile.TemporaryDirectory() as folder,patch.object(main,'ROOT',Path(folder)),patch.object(client.opener,'open',return_value=Response()):
            with self.assertRaisesRegex(ValueError,'truncated'):client.complete('تعليمات',{}, {},128)

    def test_setup_failure_writes_explicit_errors_in_other_cwd(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);input_file=root/'input.json'
            data={'chats':[{'chat_id':'c','messages':[{'message_id':'m','question':'سؤال','metadata':[1,2]}]}]}
            input_file.write_text(json.dumps(data),encoding='utf-8')
            with patch.object(main,'ROOT',root),patch('sys.argv',['main.py',str(input_file)]),patch.object(main,'settings',side_effect=ValueError('missing config')):
                self.assertEqual(main.main(),2)
            saved=json.loads((root/'answers.json').read_text(encoding='utf-8'))
            self.assertEqual(saved['chats'][0]['messages'][0]['metadata'],[1,2])
            self.assertEqual(saved['chats'][0]['messages'][0]['answer'],'error')
            self.assertEqual(json.loads((root/'run-report.json').read_text(encoding='utf-8'))['status'],'setup_failed')


if __name__=='__main__':unittest.main()
