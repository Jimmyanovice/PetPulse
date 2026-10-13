"""Exercise persistent pet -> log -> report -> chat with an explicitly labelled demo pet."""
import json
from pathlib import Path
import httpx

ROOT=Path(__file__).resolve().parents[1]
with httpx.Client(base_url='http://127.0.0.1:8001',timeout=240) as client:
    def get(path):
        r=client.get(path);r.raise_for_status();return r.json()
    def post(path,payload):
        r=client.post(path,json=payload);r.raise_for_status();return r.json()
    name='【RAG演示】小兔'
    pet=next((p for p in get('/api/pets') if p['name']==name),None)
    if pet is None:
        pet=post('/api/pets',{'name':name,'species':'rabbit','weight_kg':1.8,'breed':'演示样本'})
    pet_id=pet['id']
    logs=get(f'/api/pets/{pet_id}/logs')
    if not logs:
        post(f'/api/pets/{pet_id}/logs',{'content':'【模拟记录】今天不吃干草，粪便明显减少，腹部看起来胀。','log_type':'symptom'})
    report=post(f'/api/pets/{pet_id}/reports',{'period_days':7})
    chat=post(f'/api/pets/{pet_id}/chat',{'message':'根据日志，我可以强制喂食吗？'})
    saved_report=get(f'/api/pets/{pet_id}/reports?limit=1')[0]
    saved_chat=get(f'/api/pets/{pet_id}/chat/sessions/{chat["id"]}')
    checks={
        'report_persisted':saved_report['id']==report['id'],
        'chat_persisted':len(saved_chat['messages'])>=2,
        'risk_floor':report['risk_level'] in ('high','critical'),
        'structured_analysis':bool(report['summary'].get('analysis')),
        'sources_resolved':any(c.get('source_url') for c in saved_report['citations']),
    }
    out={'pet_id':pet_id,'checks':checks,'report':report,'chat':chat}
    dest=ROOT/'artifacts/rag-validation'
    dest.mkdir(parents=True,exist_ok=True)
    (dest/'pet-integration.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    print(checks)
    if not all(checks.values()): raise SystemExit(1)
