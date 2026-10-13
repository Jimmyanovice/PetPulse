import unittest
from app.medical_rag import triage, corpus, lexical_score, generate, ConsultationRequest


class MedicalRagTests(unittest.TestCase):
    def test_critical_not_lowered_by_generation(self):
        req = ConsultationRequest(species='cat',question='公猫尿不出来，精神很差')
        def model(*_):
            return '{"risk_level":"routine","summary":"需要评估","observed_signals":["无尿"],"possible_directions":[],"actions_now":[],"do_not":[],"follow_up_questions":[],"used_knowledge_ids":["FAKE"]}'
        result = generate(req,[],model)
        self.assertEqual(result['risk_level'],'critical')
        self.assertTrue(result['actions_now'])
        self.assertTrue(result['do_not'])
        self.assertEqual(result['evidence'],[])

    def test_explicit_denial_and_hypothetical(self):
        self.assertEqual(triage('没有呼吸困难，没有抽搐','cat')['risk_level'],'routine')
        self.assertEqual(triage('如果误食巧克力怎么办','dog')['risk_level'],'routine')
        self.assertEqual(triage('以前呼吸困难，已经恢复','cat')['risk_level'],'routine')
        self.assertEqual(triage('没有呼吸困难，但是尿不出来','cat')['risk_level'],'critical')

    def test_species_specific_appetite(self):
        self.assertEqual(triage('今天不吃，粪便减少','rabbit')['risk_level'],'urgent')
        self.assertEqual(triage('今天不吃','dog')['risk_level'],'routine')

    def test_provenance_preserved(self):
        data=corpus()
        self.assertEqual(len(data['cards']),40)
        self.assertEqual(len(data['sources']),40)
        self.assertTrue(all(c['review_status']=='approved' for c in data['cards']))
        self.assertTrue(all(c['original_review_status']=='draft' for c in data['cards']))
        self.assertEqual(data['review']['dataset_version'], data['version'])
        self.assertTrue(all(c['source_url'].startswith('https://') for c in data['cards']))

    def test_owner_wording(self):
        c = next(c for c in corpus()['cards'] if c['title']=='皮肤瘙痒')
        self.assertGreater(lexical_score('一直挠，抓痒',c),0)

    def test_reject_unreviewed_dose(self):
        req=ConsultationRequest(species='dog',question='给我用药剂量')
        def model(*_):
            return '{"risk_level":"routine","summary":"服用 5 mg","observed_signals":[],"possible_directions":[],"actions_now":[],"do_not":[],"follow_up_questions":[]}'
        with self.assertRaises(ValueError): generate(req,[],model)

    def test_persistent_drinking(self):
        self.assertEqual(triage('近三天喝水多尿也多','dog')['risk_level'],'appointment')

if __name__ == '__main__': unittest.main()
