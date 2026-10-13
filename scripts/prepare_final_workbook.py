"""Convert the team's final workbook without inventing review or risk decisions."""
import argparse
import hashlib
import json
import shutil
from datetime import date
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]


def prepare(path: Path) -> dict:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    def records(sheet):
        rows = iter(workbook[sheet].values)
        headers = next(rows)
        return [dict(zip(headers, row)) for row in rows if row[0]]
    sources = records('source')
    source_map = {r['source_id']: r for r in sources}
    if len(source_map) != len(sources):
        raise ValueError('Duplicate source IDs')
    cards = []
    species_map = {'猫': 'cat', '狗': 'dog', '犬': 'dog', '兔': 'rabbit'}
    for row_number, row in enumerate(records('card'), 2):
        source = source_map.get(row['source_id'])
        if not source or not source['官方链接']:
            raise ValueError(f'Missing source for {row["card_id"]}')
        species = [species_map[s] for s in row['物种'].split('/')]
        required = ['主题', '医学摘要', '建议行动', '禁止操作', '适用范围']
        if any(not row[k] for k in required):
            raise ValueError(f'Incomplete card {row["card_id"]}')
        cards.append({
            'knowledge_id': row['card_id'], 'title': row['主题'],
            'source_title': row['标题'], 'species': species,
            'summary': row['医学摘要'], 'actions': row['建议行动'],
            'forbidden': row['禁止操作'], 'boundary': row['适用范围'],
            'review_status': row['状态'], 'source_risk_label': row['风险等级'],
            'source_id': row['source_id'], 'source_url': source['官方链接'],
            'publisher': source['发布机构'], 'source_grade': source['来源等级'],
            'accessed_at': source['访问日期'], 'worksheet': 'card', 'row': row_number,
            'content': '\n'.join(f'{k}：{row[k]}' for k in required),
        })
    if len({c['knowledge_id'] for c in cards}) != len(cards):
        raise ValueError('Duplicate card IDs')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return {'version': f'final-{date.today():%Y%m%d}-{digest[:12]}', 'sha256': digest,
            'filename': path.name, 'cards': cards, 'sources': sources,
            'review_note': '用户指定最终资料版本；原表医学状态仍为草稿，不等同于兽医审核通过。'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('file', type=Path)
    args = parser.parse_args()
    payload = prepare(args.file)
    dest = ROOT / 'data' / 'final'
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.file, dest / 'PetPulse-final.xlsx')
    (dest / 'corpus.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Prepared {len(payload["cards"])} cards / {len(payload["sources"])} sources: {payload["version"]}')
