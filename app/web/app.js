const state = { pets: [], activePet: null, logs: [], chatSession: null, chatMessages: [], visitSummary: null };
const labels = { daily: '日常观察', symptom: '症状', medication: '用药', visit: '就诊', measurement: '测量' };
const icons = { daily: 'notebook-pen', symptom: 'triangle-alert', medication: 'pill', visit: 'stethoscope', measurement: 'ruler' };
const petList = document.querySelector('#pet-list');
const petDialog = document.querySelector('#pet-dialog');
const logDialog = document.querySelector('#log-dialog');
const toast = document.querySelector('#toast');

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]); }
function hideInternalCodes(value = '') { return String(value).replace(/\s*\[(?:PMK-[A-Za-z0-9-]+|日志#\d+)(?:\s*,\s*(?:PMK-[A-Za-z0-9-]+|日志#\d+))*\]/g, '').replace(/ {2,}/g, ' ').trim(); }
function api(path, options = {}) { return fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }).then(async response => { const payload = response.status === 204 ? null : await response.json(); if (!response.ok) throw new Error(payload?.detail || '操作失败，请稍后重试。'); return payload; }); }
function showToast(message, isError = false) { toast.textContent = message; toast.classList.toggle('error', isError); toast.classList.add('visible'); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove('visible'), 3000); }
function speciesName(species) { return {cat:'猫',dog:'犬',rabbit:'兔'}[species] || species; }
function sexName(sex) { return { female: '雌性', male: '雄性', unknown: '性别未知' }[sex] || '性别未知'; }
function observationValueName(key, value) { const labels = { appetite: { normal: '正常', reduced: '减少', none: '拒食' }, water_intake: { normal: '正常', increased: '增多', reduced: '减少' }, energy: { normal: '正常', low: '下降', high: '亢奋' } }; return labels[key]?.[value] || value; }
function formatDate(value, withTime = false) { return new Intl.DateTimeFormat('zh-CN', withTime ? { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value)); }
function toLocalInput(value = new Date()) { const d = new Date(value); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }

function renderPets() {
  petList.replaceChildren();
  state.pets.forEach(pet => {
    const button = document.createElement('button'); button.className = `pet-item ${state.activePet?.id === pet.id ? 'active' : ''}`;
    button.innerHTML = `<span class="pet-item-avatar">${pet.species === 'cat' ? '猫' : '犬'}</span><span><strong>${escapeHtml(pet.name)}</strong><small>${escapeHtml(pet.breed || speciesName(pet.species))}</small></span>`;
    button.addEventListener('click', () => selectPet(pet.id)); petList.append(button);
  });
}
function renderActivePet() {
  const pet = state.activePet; const hasPet = Boolean(pet);
  document.querySelector('#empty-state').hidden = hasPet; document.querySelector('#pet-summary').hidden = !hasPet; document.querySelector('#timeline-section').hidden = !hasPet;
  document.querySelector('#new-log-button').disabled = !hasPet; document.querySelector('#edit-pet-button').disabled = !hasPet; document.querySelector('#delete-pet-button').disabled = !hasPet;
  document.querySelector('#page-title').textContent = hasPet ? `${pet.name} 的健康日志` : '选择或创建一个宠物档案'; document.querySelector('#consult-ai-button').href = hasPet ? '/ai-lab?pet_id=' + pet.id : '/ai-lab'; if (!hasPet) return;
  document.querySelector('#pet-avatar').textContent = pet.species === 'cat' ? '猫' : '犬'; document.querySelector('#pet-name').textContent = pet.name; document.querySelector('#pet-species').textContent = speciesName(pet.species);
  document.querySelector('#pet-meta').textContent = [pet.breed, sexName(pet.sex), pet.weight_kg ? `${pet.weight_kg} kg` : '', pet.neutered ? '已绝育' : ''].filter(Boolean).join(' · ') || '基础档案待补充';
  const tags = []; if (pet.allergies) tags.push('已记录过敏'); if (pet.chronic_conditions) tags.push('有既往史'); if (pet.current_medications) tags.push('当前用药');
  document.querySelector('#pet-health-tags').innerHTML = tags.map(tag => `<span>${tag}</span>`).join('') || '<span class="muted-tag">暂无健康标记</span>';
}
function renderLogs() {
  const timeline = document.querySelector('#timeline'); timeline.replaceChildren(); document.querySelector('#log-count').textContent = `${state.logs.length} 条日志`;
  if (!state.logs.length) { timeline.innerHTML = '<div class="timeline-empty"><i data-lucide="notebook-pen"></i><p>还没有日志。记录今天的饮食、精神或任何观察，让健康时间线从这里开始。</p></div>'; lucide.createIcons(); return; }
  state.logs.forEach(log => {
    const data = log.structured_data || {}; const tags = [['appetite', '食欲'], ['water_intake', '饮水'], ['energy', '精神'], ['weight_kg', '体重']].filter(([key]) => data[key]).map(([key, name]) => `<span>${name}：${escapeHtml(observationValueName(key, data[key]))}${key === 'weight_kg' ? ' kg' : ''}</span>`).join('');
    const item = document.createElement('article'); item.className = 'timeline-item';
    item.innerHTML = `<div class="timeline-marker"><i data-lucide="${icons[log.log_type] || 'notebook-pen'}"></i></div><div class="timeline-entry"><div class="entry-meta"><span class="type-tag ${log.log_type}">${labels[log.log_type] || log.log_type}</span><time>${formatDate(log.logged_at, true)}</time></div><p>${escapeHtml(log.content).replace(/\n/g, '<br>')}</p>${tags ? `<div class="log-tags">${tags}</div>` : ''}<div class="entry-actions"><button data-delete-log="${log.id}" title="删除日志" aria-label="删除日志"><i data-lucide="trash-2"></i></button></div></div>`;
    timeline.append(item);
  });
  timeline.querySelectorAll('[data-delete-log]').forEach(button => button.addEventListener('click', async () => { if (!confirm('删除这条日志？此操作不能撤销。')) return; try { await api(`/api/pets/${state.activePet.id}/logs/${button.dataset.deleteLog}`, { method: 'DELETE' }); showToast('日志已删除'); loadLogs(); } catch (error) { showToast(error.message, true); } })); lucide.createIcons();
}
function riskLabel(level) { return { low: '低风险观察', medium: '建议关注', high: '建议尽快就医', critical: '建议立即急诊' }[level] || level; }
function renderReport(report) {
  const container = document.querySelector('#report-result'); const empty = document.querySelector('#analysis-empty');
  if (!report) { container.hidden = true; empty.hidden = false; return; }
  const logCitations = report.citations.filter(item => item.source_type === 'log'); const knowledgeCitations = report.citations.filter(item => item.source_type === 'knowledge');
  const analysis = report.summary.analysis;
  const brief = analysis ? [analysis.summary, ...(analysis.actions_now || []).slice(0, 3).map(s => '• ' + s)].join('\n\n') : hideInternalCodes(report.report_content);
  container.innerHTML = `<div class="report-meta"><span class="risk-badge ${escapeHtml(report.risk_level)}">${riskLabel(report.risk_level)}</span><time>${escapeHtml(formatDate(report.created_at, true))}</time></div><div class="assessment-brief">${escapeHtml(brief).replace(/\n/g, '<br>')}</div><details class="report-evidence"><summary>完整评估与资料依据 · ${report.summary.log_count} 条日志</summary><div class="report-content">${escapeHtml(hideInternalCodes(report.report_content)).replace(/\n/g, '<br>')}</div><div class="citation-list">${knowledgeCitations.map(item => `<div><strong>知识库参考</strong><p>${escapeHtml(item.excerpt || '')}</p></div>`).join('')}</div></details>`;
  empty.hidden = true; container.hidden = false;
}
function renderChat() {
  const container = document.querySelector('#chat-messages'); container.replaceChildren();
  if (!state.chatMessages.length) { container.innerHTML = '<div class="chat-empty"><i data-lucide="message-circle-heart"></i><p>围绕当前宠物提问。回答会参考其档案、近期日志和健康报告。</p></div>'; lucide.createIcons(); return; }
  state.chatMessages.forEach(message => {
    const citations = message.citations || []; const logs = citations.filter(item => item.source_type === 'log'); const knowledge = citations.filter(item => item.source_type === 'knowledge');
    const article = document.createElement('article'); article.className = `chat-message ${message.role}`;
    const risk = message.risk_level ? `<span class="risk-badge ${escapeHtml(message.risk_level)}">${riskLabel(message.risk_level)}</span>` : '';
    const evidence = message.role === 'assistant' && citations.length ? `<details class="chat-evidence"><summary>参考 ${logs.length} 条日志${knowledge.length ? `，${knowledge.length} 条知识` : ''}</summary><div>${logs.map(item => `<p><strong>日志记录</strong>${escapeHtml(item.excerpt || '')}</p>`).join('')}${knowledge.map(item => `<p><strong>知识库参考</strong>${escapeHtml(item.excerpt || '')}</p>`).join('')}</div></details>` : '';
    article.innerHTML = `<div class="chat-message-meta"><span>${message.role === 'user' ? '你的问题' : 'PetPulse AI'}</span>${risk}</div><div class="chat-bubble">${escapeHtml(hideInternalCodes(message.content)).replace(/\n/g, '<br>')}</div>${evidence}`;
    container.append(article);
  });
  container.scrollTop = container.scrollHeight;
}
function renderVisitSummary(summary) {
  const container = document.querySelector('#visit-summary-result'); const copyButton = document.querySelector('#copy-summary-button'); state.visitSummary = summary || null;
  if (!summary) { container.hidden = true; copyButton.disabled = true; return; }
  const citations = summary.citations || []; const logs = citations.filter(item => item.source_type === 'log'); const report = citations.filter(item => item.source_type === 'report'); const chat = citations.filter(item => item.source_type === 'chat');
  container.innerHTML = `<div class="report-meta"><span class="risk-badge ${escapeHtml(summary.risk_level)}">${riskLabel(summary.risk_level)}</span><time>${escapeHtml(formatDate(summary.created_at, true))}</time></div><div class="summary-content">${escapeHtml(hideInternalCodes(summary.content)).replace(/\n/g, '<br>')}</div><p class="summary-evidence">整合 ${logs.length} 条日志${report.length ? '、最新健康报告' : ''}${chat.length ? '、近期 AI 对话' : ''}</p>`;
  container.hidden = false; copyButton.disabled = false;
}
async function loadLatestVisitSummary() { if (!state.activePet) return; const summaries = await api(`/api/pets/${state.activePet.id}/visit-summaries?limit=1`); renderVisitSummary(summaries[0]); }
async function loadLatestChat() {
  if (!state.activePet) return;
  state.chatSession = null; state.chatMessages = [];
  const sessions = await api(`/api/pets/${state.activePet.id}/chat/sessions?limit=1`);
  if (sessions[0]) { const session = await api(`/api/pets/${state.activePet.id}/chat/sessions/${sessions[0].id}`); state.chatSession = session; state.chatMessages = session.messages; }
  document.querySelector('#chat-context-name').textContent = state.activePet.name;
  renderChat();
}
async function loadLatestReport() { if (!state.activePet) return; const reports = await api(`/api/pets/${state.activePet.id}/reports?limit=1`); renderReport(reports[0]); }
async function loadPets() { state.pets = await api('/api/pets'); renderPets(); if (state.pets.length && !state.activePet) await selectPet(state.pets.find(p => p.id === Number(new URLSearchParams(location.search).get('pet_id')))?.id || state.pets[0].id); else renderActivePet(); }
async function selectPet(id) { state.activePet = state.pets.find(pet => pet.id === id); renderPets(); renderActivePet(); await Promise.all([loadLogs(), loadLatestReport()]); }
async function loadLogs() { if (!state.activePet) return; const type = document.querySelector('#log-filter').value; state.logs = await api(`/api/pets/${state.activePet.id}/logs?limit=100${type ? `&log_type=${type}` : ''}`); renderLogs(); }
function openPetDialog(edit = false) { const form = document.querySelector('#pet-form'); form.reset(); form.dataset.editing = edit ? 'true' : ''; document.querySelector('#pet-dialog-title').textContent = edit ? '编辑宠物档案' : '新建宠物档案'; if (edit && state.activePet) Object.entries(state.activePet).forEach(([key, value]) => { const field = form.elements.namedItem(key); if (!field || value == null) return; if (field.type === 'checkbox') field.checked = value; else field.value = key === 'birth_date' ? String(value).slice(0, 10) : value; }); petDialog.showModal(); }
function openLogDialog() { const form = document.querySelector('#log-form'); form.reset(); form.elements.logged_at.value = toLocalInput(); logDialog.showModal(); }
function formValues(form) { const raw = Object.fromEntries(new FormData(form).entries()); return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== '')); }

document.querySelector('#new-pet-button').addEventListener('click', () => openPetDialog()); document.querySelector('#edit-pet-button').addEventListener('click', () => openPetDialog(true)); document.querySelector('#new-log-button').addEventListener('click', openLogDialog); document.querySelector('#log-filter').addEventListener('change', loadLogs); document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('.analysis-tab').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.analysis-tab').forEach(tab => tab.classList.toggle('active', tab === button)); document.querySelectorAll('.analysis-view').forEach(panel => { panel.hidden = panel.id !== button.dataset.panel; }); }));
document.querySelector('#generate-report-button').addEventListener('click', async event => { if (!state.activePet) return; const button = event.currentTarget; button.disabled = true; button.innerHTML = '<i data-lucide="loader-circle"></i>正在分析日志'; lucide.createIcons(); try { const report = await api(`/api/pets/${state.activePet.id}/reports`, { method: 'POST', body: JSON.stringify({ period_days: Number(document.querySelector('#analysis-period').value) }) }); renderReport(report); showToast('日志评估已生成'); } catch (error) { showToast(error.message, true); } finally { button.disabled = false; button.innerHTML = '<i data-lucide="sparkles"></i>生成日志评估'; lucide.createIcons(); } });
document.querySelector('#pet-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const values = formValues(form); values.neutered = form.elements.neutered.checked; if (values.weight_kg) values.weight_kg = Number(values.weight_kg); try { const method = form.dataset.editing ? 'PATCH' : 'POST'; const url = form.dataset.editing ? `/api/pets/${state.activePet.id}` : '/api/pets'; const saved = await api(url, { method, body: JSON.stringify(values) }); petDialog.close(); state.activePet = saved; await loadPets(); await selectPet(saved.id); showToast(form.dataset.editing ? '档案已更新' : '宠物档案已创建'); } catch (error) { showToast(error.message, true); } });
document.querySelector('#log-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const values = formValues(form); const structured_data = {}; ['appetite', 'water_intake', 'energy', 'weight_kg'].forEach(key => { if (values[key]) structured_data[key] = key === 'weight_kg' ? Number(values[key]) : values[key]; delete values[key]; }); values.structured_data = structured_data; values.logged_at = new Date(values.logged_at).toISOString(); try { await api(`/api/pets/${state.activePet.id}/logs`, { method: 'POST', body: JSON.stringify(values) }); logDialog.close(); showToast('日志已保存'); loadLogs(); } catch (error) { showToast(error.message, true); } });
const rabbitOption = document.createElement('option'); rabbitOption.value = 'rabbit'; rabbitOption.textContent = '兔'; document.querySelector('[name="species"]').append(rabbitOption);
document.querySelector('.phase-badge').textContent = '可溯源 AI';
let finalCards = [];
function addReadableSources() {
  document.querySelectorAll('.citation-list div, .chat-evidence p').forEach(node => {
    if (node.querySelector('a')) return;
    const card = finalCards.find(c => node.textContent.includes(c.title));
    if (!card) return;
    const link = document.createElement('a'); link.href = card.source_url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = `${card.source_title} · ${card.review_status === 'approved' ? '医学组员已审核' : '资料待审核'} ↗`; link.style.display = 'block'; link.style.fontSize = '12px'; node.append(link);
  });
  if (state.activePet?.species === 'rabbit' && document.querySelector('#pet-avatar').textContent !== '兔') document.querySelector('#pet-avatar').textContent = '兔';
  document.querySelectorAll('.pet-item').forEach((node,i) => { const avatar=node.querySelector('.pet-item-avatar'); if (state.pets[i]?.species === 'rabbit' && avatar.textContent !== '兔') avatar.textContent = '兔'; });
}
api('/api/ai/knowledge').then(data => { finalCards = data.cards; addReadableSources(); }).catch(() => {});
new MutationObserver(addReadableSources).observe(document.querySelector('.main-content'), {childList:true,subtree:true});
const deleteDialog = document.querySelector('#delete-pet-dialog');
let deletion = null;
document.querySelector('#delete-pet-button').addEventListener('click', () => {
  if (!state.activePet) return;
  deletion = { id: state.activePet.id, name: state.activePet.name, token: null, busy: false };
  document.querySelector('#delete-pet-title').textContent = '删除宠物 · 第一次确认';
  document.querySelector('#delete-pet-warning').textContent = `你即将删除「${deletion.name}」的全部健康档案。确定要继续吗？`;
  document.querySelector('#delete-name-label').hidden = true;
  document.querySelector('#delete-name-input').value = '';
  document.querySelector('#delete-pet-error').textContent = '';
  document.querySelector('#confirm-delete-pet').textContent = '我已了解，继续确认';
  document.querySelector('#confirm-delete-pet').disabled = false;
  deleteDialog.showModal();
});
document.querySelector('#cancel-delete-pet').onclick = () => { if (!deletion?.busy) deleteDialog.close(); };
deleteDialog.addEventListener('cancel', e => { if (deletion?.busy) e.preventDefault(); });
document.querySelector('#delete-name-input').oninput = e => {
  document.querySelector('#confirm-delete-pet').disabled = !deletion?.token || deletion.busy || e.target.value !== deletion.name;
};
document.querySelector('#delete-pet-form').addEventListener('submit', async e => {
  e.preventDefault(); if (!deletion || deletion.busy) return;
  const target = deletion;
  const button = document.querySelector('#confirm-delete-pet');
  const error = document.querySelector('#delete-pet-error');
  const input = document.querySelector('#delete-name-input');
  if (target.token && input.value !== target.name) { error.textContent = '名字不匹配，未执行删除。'; return; }
  target.busy = true; button.disabled = true; document.querySelector('#cancel-delete-pet').disabled = true; error.textContent = '';
  try {
    if (!target.token) {
      const preview = await api(`/api/pets/${target.id}/deletion-confirmation`, { method: 'POST', body: JSON.stringify({ first_confirmed: true }) });
      if (preview.name !== target.name) throw new Error('宠物档案已变更，请取消后重新确认。');
      target.token = preview.confirmation_token;
      document.querySelector('#delete-pet-title').textContent = '删除宠物 · 第二次确认';
      document.querySelector('#delete-pet-warning').textContent = `最后确认：请输入「${target.name}」，再点击永久删除。确认有效期为 5 分钟。`;
      document.querySelector('#delete-name-label').hidden = false;
      button.textContent = '永久删除宠物'; input.focus();
    } else {
      await api(`/api/pets/${target.id}`, { method: 'DELETE', body: JSON.stringify({ confirmation_token: target.token, confirm_name: input.value }) });
      deleteDialog.close(); deletion = null;
      state.activePet = null; state.logs = []; state.chatMessages = []; state.chatSession = null; state.visitSummary = null;
      const url = new URL(location.href); url.searchParams.delete('pet_id'); history.replaceState(null, '', url);
      renderActivePet(); renderReport(null); showToast('宠物及关联健康记录已删除');
      await loadPets().catch(() => showToast('删除已完成，列表刷新失败，请刷新页面。', true));
    }
  } catch (err) { error.textContent = err.message; }
  finally {
    target.busy = false; document.querySelector('#cancel-delete-pet').disabled = false;
    button.disabled = Boolean(target.token) && input.value !== target.name;
  }
});
loadPets().catch(error => { showToast(error.message, true); document.querySelector('#page-title').textContent = '无法连接宠物档案服务'; }); lucide.createIcons();
