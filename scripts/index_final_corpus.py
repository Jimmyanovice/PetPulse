"""Transactional, idempotent PostgreSQL import with resumable vector generation."""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import DATABASE_URL, EMBEDDING_API_URL, EMBEDDING_API_KEY, EMBEDDING_MODEL, EMBEDDING_ROUTE
from app.medical_rag import corpus
from scripts.generate_embeddings_api import request_embeddings, vector_literal
import psycopg


def main():
    data = corpus()
    with psycopg.connect(DATABASE_URL) as con:
        con.execute((Path(__file__).resolve().parents[1]/'init/009-final-rag.sql').read_text(encoding='utf-8'))
        con.execute('''INSERT INTO rag_datasets(version,sha256,filename,metadata) VALUES(%s,%s,%s,%s::jsonb)
            ON CONFLICT(version) DO UPDATE SET metadata=EXCLUDED.metadata''', (data['version'],data['sha256'],data['filename'],json.dumps({'review_note':data['review_note'], 'review':data.get('review')})))
        for c in data['cards']:
            con.execute('''INSERT INTO rag_cards(dataset_version,knowledge_id,species,payload) VALUES(%s,%s,%s,%s::jsonb)
                ON CONFLICT(dataset_version,knowledge_id) DO UPDATE SET payload=EXCLUDED.payload''',
                (data['version'],c['knowledge_id'],c['species'],json.dumps(c,ensure_ascii=False)))
        con.commit()
        rows = con.execute('''SELECT knowledge_id,payload FROM rag_cards WHERE dataset_version=%s
            AND (embedding IS NULL OR embedding_model IS DISTINCT FROM %s) ORDER BY knowledge_id''',
            (data['version'],EMBEDDING_MODEL)).fetchall()
        for start in range(0,len(rows),8):
            batch=rows[start:start+8]
            vectors=request_embeddings(EMBEDDING_API_URL,EMBEDDING_API_KEY,EMBEDDING_MODEL,EMBEDDING_ROUTE,
                [f'物种：{c["species"]}\n主题：{c["title"]}\n{c["content"]}' for _,c in batch])
            for (key,c),vector in zip(batch,vectors,strict=True):
                if len(vector)!=3072: raise ValueError('Embedding dimension mismatch')
                con.execute('UPDATE rag_cards SET embedding=%s::halfvec,embedding_model=%s WHERE dataset_version=%s AND knowledge_id=%s',
                    (vector_literal(vector),EMBEDDING_MODEL,data['version'],key))
            con.commit()
            print(f'Indexed {min(start+8,len(rows))}/{len(rows)}',flush=True)
        print('Final dataset:',data['version'],flush=True)


if __name__=='__main__': main()
