'use strict';
(() => {
  const CATALOG = Object.freeze([
    { id: 'lift', sku: 'ПД-01', name: 'Подъёмник двухстоечный', price: 240000, type: 'lift' },
    { id: 'compressor', sku: 'КМ-02', name: 'Компрессор', price: 35000, type: 'compressor' },
    { id: 'stand', sku: 'СТ-03', name: 'Стенд для диагностики', price: null, type: 'stand' },
    { id: 'jack', sku: 'ДК-04', name: 'Домкрат подкатной', price: 18000, type: 'jack' }
  ]);
  const DEALS = [
    { id: 'service', client: 'ООО «Автосервис Пример»', name: 'Оснащение автосервиса' },
    { id: 'workshop', client: 'ООО «Мастерская Демо»', name: 'Оборудование новой мастерской' }
  ];
  const STORAGE_KEY = 'kp-demo-draft-v1';
  const seed = () => ({ version: 1, dealId: 'service', items: [{ id: 'lift', quantity: '1' }, { id: 'compressor', quantity: '2' }], delivery: '' });
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
  const validQuantity = value => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 10000;
  const validState = s => s && s.version === 1 && DEALS.some(d => d.id === s.dealId) && typeof s.delivery === 'string' && s.delivery.length <= 160 && Array.isArray(s.items) && s.items.length <= CATALOG.length && new Set(s.items.map(i => i.id)).size === s.items.length && s.items.every(i => CATALOG.some(p => p.id === i.id) && typeof i.quantity === 'string' && i.quantity.length <= 12);
  let state = seed();
  let savedAt = null;
  let restoreMessage = '';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const draft = JSON.parse(stored);
      if (validState(draft.state)) { state = draft.state; savedAt = draft.savedAt; restoreMessage = 'Сохранённый черновик восстановлен.'; }
      else restoreMessage = 'Сохранённый черновик не распознан. Открыт исходный пример.';
    }
  } catch { restoreMessage = 'Не удалось прочитать черновик. Можно работать без сохранения.'; }
  let dirty = false;
  let searchOpen = false;
  let toastTimer;
  const product = id => CATALOG.find(p => p.id === id);
  const deal = () => DEALS.find(d => d.id === state.dealId);
  const issues = () => {
    const result = [];
    if (!state.items.length) result.push('Добавьте хотя бы один товар');
    state.items.forEach(item => {
      const p = product(item.id);
      if (!validQuantity(item.quantity)) result.push(`${p.sku}: проверьте количество`);
      if (p.price === null) result.push(`${p.sku}: отсутствует цена`);
    });
    if (!state.delivery.trim()) result.push('Не указан срок поставки');
    return result;
  };
  const total = () => state.items.reduce((sum, item) => sum + (product(item.id).price !== null && validQuantity(item.quantity) ? product(item.id).price * Number(item.quantity) : 0), 0);
  const completeAmount = () => state.items.length > 0 && state.items.every(i => product(i.id).price !== null && validQuantity(i.quantity));
  const icon = type => {
    const paths = {
      lift: '<path d="M7 5v29M31 5v29M4 34h8M27 34h8M7 21l10 8M31 21l-10 8M13 29h14M7 6h3v14M31 6h-3v14"/>',
      compressor: '<rect x="4" y="17" width="32" height="14" rx="6"/><path d="M11 17V9h7v8M22 17V9h7v8M8 31v4M32 31v4M5 13h5M31 13h4M15 22h10"/>',
      stand: '<rect x="7" y="5" width="26" height="19" rx="2"/><path d="M12 18l5-5 5 4 5-7M20 24v10M10 35h20"/>',
      jack: '<path d="M5 28h26l-5-8H14l-6 8M12 20l4-8h9M25 12l7-7M17 12l7 8"/><circle cx="10" cy="32" r="3"/><circle cx="29" cy="32" r="3"/>'
    };
    return `<svg viewBox="0 0 40 40" aria-hidden="true">${paths[type]}</svg>`;
  };
  const removeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg>';
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000); }
  function changed() { dirty = true; updateSummary(); }
  function renderItems() {
    $('items').innerHTML = state.items.map(item => {
      const p = product(item.id), valid = validQuantity(item.quantity);
      return `<tr><td><div class="product-cell"><div class="product-icon">${icon(p.type)}</div><div><span class="product-title">${escape(p.name)}</span><span class="product-sku">${p.sku}</span></div></div></td><td><input type="text" inputmode="numeric" class="quantity" maxlength="12" value="${escape(item.quantity)}" data-quantity="${p.id}" aria-label="Количество: ${escape(p.name)}" aria-invalid="${!valid}" aria-describedby="error-${p.id}"><span id="error-${p.id}" class="qty-error" ${valid ? 'hidden' : ''}>Целое число 1–10 000</span></td><td class="${p.price === null ? 'warning-text' : ''}">${p.price === null ? 'Нет цены' : money(p.price)}</td><td data-line-total="${p.id}">${p.price === null || !valid ? '—' : money(p.price * Number(item.quantity))}</td><td><button class="icon-button" data-remove="${p.id}" aria-label="Удалить: ${escape(p.name)}">${removeIcon}</button></td></tr>`;
    }).join('');
    $('empty-message').hidden = state.items.length > 0;
    $('item-count').textContent = `${state.items.length} поз.`;
  }
  function documentContent(draft = true) {
    const d = deal(), errors = issues();
    const rows = state.items.map((item, i) => {
      const p = product(item.id), valid = validQuantity(item.quantity);
      return `<tr><td>${i + 1}</td><td>${escape(p.name)}<span class="sku">${p.sku}</span></td><td>${valid ? Number(item.quantity) : 'Ошибка'}</td><td>${p.price === null ? 'Нет цены' : money(p.price)}</td><td>${p.price === null || !valid ? '—' : money(p.price * Number(item.quantity))}</td></tr>`;
    }).join('');
    return `<h3>Коммерческое предложение</h3><div class="document-meta"><div><span>Для:</span> <b class="doc-client">${escape(d.client)}</b><br>${escape(d.name)}</div><div><span>Дата:</span> ${new Date().toLocaleDateString('ru-RU')}<br><span>Номер:</span> КП-0001</div></div><div class="document-table-scroll"><table class="document-table"><thead><tr><th>№</th><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Товары не добавлены</td></tr>'}</tbody><tfoot><tr><td colspan="4" style="text-align:right">${completeAmount() ? 'Итого:' : 'Известная сумма:'}</td><td>${money(total())}</td></tr></tfoot></table></div>${state.delivery.trim() ? `<p class="doc-condition"><b>Срок поставки:</b> ${escape(state.delivery.trim())}</p>` : ''}${draft && errors.length ? `<div class="document-warning">! &nbsp; ${escape(errors[0])}${errors.length > 1 ? ` · ещё ${errors.length - 1}` : ''}</div>` : ''}${draft ? '<div class="watermark" aria-hidden="true">ЧЕРНОВИК</div>' : ''}<div class="document-footer"><div class="signature">Менеджер</div><div class="signature">Подпись</div></div><p class="doc-disclaimer">Демонстрационный документ. Все данные условные.<br>Налоги, скидки и наличие не подтверждены.</p>`;
  }
  function updateSummary() {
    const errors = issues();
    $('client-name').textContent = deal().client; $('deal-name').textContent = deal().name;
    $('paper').innerHTML = documentContent();
    $('editor-total').textContent = money(total());
    $('editor-total-label').textContent = completeAmount() ? 'Итого' : 'Известная сумма';
    $('download').disabled = $('print').disabled = errors.length > 0;
    $('delivery').setAttribute('aria-invalid', String(!state.delivery.trim()));
    $('delivery-note').textContent = state.delivery.trim() ? 'Этот срок будет указан в документе.' : 'Укажите срок перед выпуском документа.';
    $('delivery-note').classList.toggle('warning-text', !state.delivery.trim());
    $('validation-message').textContent = errors.length ? errors[0] : 'Данные проверены для демо';
    $('validation-detail').textContent = errors.length ? (errors.length > 1 ? errors.slice(1).join(' · ') : 'Выпуск станет доступен после заполнения.') : 'Можно скачать HTML или сохранить PDF через печать.';
    document.querySelector('.validation').classList.toggle('valid', !errors.length);
    document.querySelector('.status-icon').textContent = errors.length ? '!' : '✓';
    $('save-status').textContent = dirty ? 'Есть несохранённые изменения.' : savedAt ? `Сохранено в этом браузере · ${new Date(savedAt).toLocaleString('ru-RU')}` : 'Черновик сохраняется только в этом браузере.';
  }
  function renderSearch() {
    $('search-results').hidden = !searchOpen;
    if (!searchOpen) return;
    const query = $('search').value.trim().toLocaleLowerCase('ru-RU');
    const found = CATALOG.filter(p => `${p.name} ${p.sku}`.toLocaleLowerCase('ru-RU').includes(query));
    $('search-results').innerHTML = found.length ? found.map(p => {
      const exists = state.items.some(i => i.id === p.id);
      return `<div class="result"><div><strong>${escape(p.name)}</strong><p>${p.sku} · ${p.price === null ? 'Цена не указана' : money(p.price)}</p></div><button class="button ${exists ? 'quiet' : 'outline'}" data-add="${p.id}" ${exists ? 'disabled' : ''}>${exists ? 'Добавлен' : 'Добавить'}</button></div>`;
    }).join('') : '<p class="no-results" role="status">Товар не найден. Попробуйте другое название или артикул.</p>';
  }
  $('items').addEventListener('input', event => {
    const id = event.target.dataset.quantity;
    if (!id) return;
    const item = state.items.find(i => i.id === id); item.quantity = event.target.value;
    const valid = validQuantity(item.quantity); event.target.setAttribute('aria-invalid', String(!valid)); $('error-' + id).hidden = valid;
    document.querySelector(`[data-line-total="${id}"]`).textContent = valid && product(id).price !== null ? money(Number(item.quantity) * product(id).price) : '—';
    changed();
  });
  $('items').addEventListener('click', event => {
    const button = event.target.closest('[data-remove]'); if (!button) return;
    const index = state.items.findIndex(i => i.id === button.dataset.remove);
    state.items.splice(index, 1); renderItems(); changed(); renderSearch();
    const next = document.querySelectorAll('[data-remove]'); (next[Math.min(index, next.length - 1)] || $('search')).focus();
  });
  $('search').addEventListener('input', () => { searchOpen = true; renderSearch(); });
  $('search').addEventListener('keydown', event => { if (event.key === 'Escape') { searchOpen = false; renderSearch(); } if (event.key === 'Enter') { event.preventDefault(); searchOpen = true; renderSearch(); } });
  $('search-button').addEventListener('click', () => { searchOpen = !searchOpen; renderSearch(); if (searchOpen) $('search').focus(); });
  $('search-results').addEventListener('click', event => {
    const button = event.target.closest('[data-add]'); if (!button || state.items.some(i => i.id === button.dataset.add)) return;
    state.items.push({ id: button.dataset.add, quantity: '1' }); renderItems(); changed(); renderSearch(); toast('Товар добавлен в предложение.');
  });
  $('delivery').value = state.delivery;
  $('delivery').addEventListener('input', event => { state.delivery = event.target.value; changed(); });
  $('select-deal').addEventListener('click', () => {
    $('deal-options').innerHTML = DEALS.map(d => `<button class="deal-option" data-deal="${d.id}">${escape(d.client)}<span>${escape(d.name)}${state.dealId === d.id ? ' · выбрана' : ''}</span></button>`).join('');
    $('deal-dialog').showModal();
  });
  $('close-dialog').addEventListener('click', () => $('deal-dialog').close());
  $('deal-options').addEventListener('click', event => { const button = event.target.closest('[data-deal]'); if (!button) return; state.dealId = button.dataset.deal; changed(); $('deal-dialog').close(); });
  $('save').addEventListener('click', () => {
    try { const timestamp = new Date().toISOString(); localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, savedAt: timestamp })); savedAt = timestamp; dirty = false; updateSummary(); toast('Черновик сохранён в этом браузере.'); }
    catch { toast('Не удалось сохранить. Браузер ограничил доступ к хранилищу.'); }
  });
  $('reset').addEventListener('click', () => { if (dirty && !confirm('Вернуть исходный пример? Несохранённые изменения будут потеряны. Сохранённый черновик останется в браузере до следующего сохранения.')) return; state = seed(); $('delivery').value = ''; $('search').value = ''; searchOpen = false; renderItems(); changed(); renderSearch(); toast('Открыт исходный пример. Сохранённый черновик не изменён.'); });
  function documentHTML() {
    return `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>КП-0001 · ${escape(deal().client)}</title><style>body{font-family:Arial,sans-serif;color:#15243b;margin:0;background:#eef2f6}.paper{box-sizing:border-box;max-width:210mm;min-height:270mm;margin:25px auto;background:white;padding:20mm;display:flex;flex-direction:column}h3{font-size:22px;text-align:center;margin:5px 0 30px}.document-meta{display:flex;justify-content:space-between;gap:20px;font-size:14px;line-height:1.7;margin-bottom:30px}.document-meta span,.sku{color:#65758b}.document-table{width:100%;border-collapse:collapse;font-size:13px}.document-table th{background:#f2f5f9;text-align:left}.document-table td,.document-table th{border:1px solid #dbe3ed;padding:12px 9px}.document-table td:nth-child(4),.document-table td:nth-child(5){white-space:nowrap;text-align:right}.sku{display:block;font-size:12px;margin-top:5px}tfoot{font-weight:bold}.doc-condition{font-size:14px;line-height:1.7;margin-top:28px;white-space:pre-wrap;overflow-wrap:anywhere}.document-footer{margin-top:auto;padding-top:50mm;display:flex;justify-content:space-between}.signature{border-top:1px solid #cbd4df;width:35%;font-size:12px;color:#65758b;padding-top:7px}.doc-disclaimer{font-size:12px;color:#65758b;line-height:1.5;margin-top:25px}.print-actions{text-align:center;padding:18px}button{font:14px Arial;padding:12px 18px;background:#1467df;border:0;border-radius:5px;color:white;cursor:pointer}@media(max-width:600px){.paper{padding:20px;min-height:240mm}.document-meta{font-size:12px}.document-table{font-size:11px}.document-table td,.document-table th{padding:8px 5px}}@media print{@page{size:A4;margin:14mm}body{background:white}.print-actions{display:none}.paper{padding:0;margin:0;max-width:none;min-height:250mm}tr{break-inside:avoid}}</style></head><body><div class="print-actions"><button onclick="window.print()">Печать / сохранить PDF</button></div><main class="paper">${documentContent(false)}</main></body></html>`;
  }
  $('download').addEventListener('click', () => {
    if (issues().length) return;
    const blob = new Blob([documentHTML()], { type: 'text/html;charset=utf-8' }), url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'КП-0001.html'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('HTML-документ скачан. Откройте его для печати или сохранения PDF.');
  });
  $('print').addEventListener('click', () => { if (!issues().length) window.print(); });
  renderItems(); updateSummary();
  if (restoreMessage) toast(restoreMessage);
})();
