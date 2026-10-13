# PetPulse 最终资料版本 RAG 演示

本次使用团队最终交付资料作为唯一检索版本。共 40 张资料卡和 40 条来源。公开仓库包含 `data/final/corpus.json` 与版本匹配的审核记录，首次启动直接执行索引即可。工作簿原件仅在开发者本地保存于 `data/final/PetPulse-final.xlsx`，不公开分发；JSON 保留文件 SHA256、来源和原表行号以便溯源。

这是调用现有大模型与嵌入 API 的 RAG 系统，无需训练基础模型。现有 `.env` 配置用于模型调用；密钥仅由后端读取。2026-10-13 项目负责人明确确认医学专业组员已完成本版知识库审核，确认记录保存于 `data/final/review.json`，仅对匹配版本生效。原始 Excel 和草稿标记保留用于溯源，运行时资料卡状态为 `approved`，同步至数据库；不代表工程分流规则或具体 AI 回答已获医学审核。旧报告与聊天作为历史记录保留，新生成内容采用最新审核状态。

## 使用

- 健康日志与原有宠物管理：<http://127.0.0.1:8001/>
- AI 健康工作台与案例检查：<http://127.0.0.1:8001/ai-lab>
- API：<http://127.0.0.1:8001/docs>

工作台保留宠物侧栏，主体左侧显示宠物档案和近 30 天日志，右侧为连续 AI 对话。侧栏新增“兽医知识资料”入口，独立资料页支持物种筛选、搜索和来源查看，可返回原对话并保留输入。通过 `/ai-lab?view=knowledge` 可直接访问资料页，`pet_id` 保留宠物上下文。真实宠物对话保存于数据库，进入时恢复最近会话；“新对话”不删除历史。案例模式不写入真实宠物记录，最多传递最近 8 条对话作为追问上下文。历史 AI 回答不作为医学证据。

日志页移除独立 AI 问答栏和多标签工作区，显示简要日志评估（摘要与最多 3 条行动建议），完整评估及知识来源可展开。“与兽医 AI 对话”通过 `pet_id` 跳转到该宠物的对话工作台。

猫、狗、兔均可创建档案。公开仓库不包含宠物记录或数据库备份；本地旧数据保留。持久化集成检查会创建明确标记的虚构兔类样本。

## 删除宠物

日志页顶部“删除宠物”先显示删除范围，再要求输入完整宠物名字并点击“永久删除宠物”。任一阶段均可取消。删除会级联移除该宠物的日志、报告、对话、就诊摘要及引用，不影响其他宠物或公共知识库。

后端先通过 `POST /api/pets/{pet_id}/deletion-confirmation`（`first_confirmed: true`）获得 5 分钟有效的确认凭据，再通过 `DELETE /api/pets/{pet_id}` 提交 `confirmation_token` 和 `confirm_name`。凭据绑定宠物 ID、名字和档案更新时间；档案变更或服务重启后需重新确认。旧版无确认请求的 DELETE 不再生效。

## 启动与导入

```powershell
docker compose up -d db
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe scripts/index_final_corpus.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

索引脚本创建 `rag_datasets` 与 `rag_cards`，按文件 SHA256 隔离版本，分批持久化 3072 维向量。重复执行不重复入库，模型变更时重新嵌入。导入异常不清空已提交数据。新文件导入后重启后端，刷新缓存。固定 Docker volume 继续提供持久化，禁止通过 `docker compose down -v` 删除卷。

需要更新资料时，可运行 `python scripts/prepare_final_workbook.py "团队交付文件.xlsx"`。新资料默认保留原表审核状态；医学审核完成后单独更新 `data/final/review.json`，其版本必须与新语料一致，不继承旧版本批准。

## 推理流程

1. 服务读取当前宠物的物种和最近日志；真实宠物请求中物种不一致返回 422。
2. 规则识别急症，保留显式否定、假设和历史事件的区别。风险规则属于待兽医复核的产品分流策略。
3. 强制物种过滤；向量排名与中文关键词、同义词排名进行融合。低相似度且无关键词匹配时返回检索缺口。
4. 大模型返回 Pydantic 校验的结构化结果，不能降低规则风险；未经审核的剂量输出被拒绝。
5. 只有模型声明使用且实际检索到的资料才绑定为回答引用。来源链接、原表行号和审核状态可追踪。
6. 日志报告保存结构化分析；聊天保存文本、等级及实际引用。前端正文隐藏内部编码，依据区显示可读来源。

## 集成契约

`POST /api/ai/consult`：

```json
{
  "species": "dog",
  "question": "最近喝水变多应该记录什么？",
  "pet_id": null,
  "profile": "成年犬，10 kg",
  "logs": ["近三天饮水增多，排尿也多，精神正常"],
  "mode": "chat"
}
```

`pet_id` 非空时由服务读取真实档案与日志。返回 `risk_level`、`summary`、`observed_signals`、`possible_directions`、`actions_now`、`do_not`、`follow_up_questions`、`evidence`、`retrieved_evidence`、`triage`、`dataset_version` 和 `disclaimer`。五级风险分别为 routine、monitor、appointment、urgent、critical；旧日志接口保持 low、medium、high、critical 兼容映射。

`GET /api/ai/knowledge` 返回资料版本和可读资料卡。`/search` 和 `/ask` 要求指定 cat、dog 或 rabbit，均使用此次最终语料。

## 验证

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe scripts/evaluate_final_rag.py
.\.venv\Scripts\python.exe scripts/check_pet_rag_integration.py
```

自动评测结果位于 `artifacts/rag-validation/results.json`。案例预期是工程草稿，未经独立兽医确认；通过这些案例只能说明对应工程检查通过，不能证明临床准确率或完整疾病覆盖。最终文件并非包含上一批所有急症资料；规则可识别部分急症，但缺失的专门临床依据会显式保留为知识缺口。

需要医疗队员复核：规则时间边界、慢病升级条件、病例预期风险等级，以及资料摘要是否忠实支持各结论。还需增加未覆盖主题、独立评测病例和来源章节证据，才能进行正式医学发布。
