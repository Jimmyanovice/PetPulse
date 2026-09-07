-- :query_embedding must be a pgvector literal; keep approved filtering enabled.
SELECT knowledge_id, title, content, species, domain, risk_level,
       clinical_use_boundary, source_urls,
       1 - (embedding <=> :query_embedding::vector) AS similarity
FROM pet_medical_knowledge
WHERE embedding IS NOT NULL
  AND review_status = 'approved'
  AND (:species IS NULL OR :species = ANY(species))
  AND (:domain IS NULL OR domain = :domain)
ORDER BY embedding <=> :query_embedding::vector
LIMIT :top_k;
