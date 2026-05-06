import {
  getBlacklist,
  addDomainToBlacklist,
  removeDomainFromBlacklist,
  resetBlacklist,
} from '../shared/blacklist.js';
import { getIngestionSummary } from '../background/ingestion.js';
import { STORAGE_KEYS } from '../shared/constants.js';
import { localStore } from '../shared/storage.js';

async function loadApiKey() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
  const key = result[STORAGE_KEYS.API_KEY];
  if (key) {
    document.getElementById('api-key-input').placeholder =
      '••••••••' + key.slice(-4);
  }
}

async function loadIngestion() {
  const summary = await getIngestionSummary(localStore);
  const valEl = document.getElementById('ingestion-value');
  const subEl = document.getElementById('ingestion-sub');
  if (summary.score === null) {
    valEl.textContent = '—';
    subEl.textContent = `No data yet (${summary.windowDays}-day window)`;
  } else {
    valEl.textContent = `${summary.score.toFixed(1)} / 10`;
    subEl.textContent = `${summary.entryCount} pages · last ${summary.windowDays} days`;
  }
}

async function renderList() {
  const list = await getBlacklist(localStore);
  const ul = document.getElementById('domain-list');
  ul.innerHTML = '';
  for (const domain of [...list].sort()) {
    const li = document.createElement('li');
    li.className = 'domain-item';
    li.innerHTML = `
      <span class="domain-name">${domain}</span>
      <button class="btn-remove" data-domain="${domain}" title="Remove">×</button>
    `;
    ul.appendChild(li);
  }
}

async function main() {
  await Promise.all([loadApiKey(), loadIngestion(), renderList()]);

  document.getElementById('save-key-btn').addEventListener('click', async () => {
    const val = document.getElementById('api-key-input').value.trim();
    if (!val) return;
    await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: val });
    document.getElementById('api-key-input').value = '';
    document.getElementById('api-key-input').placeholder = '••••••••' + val.slice(-4);
    const status = document.getElementById('key-status');
    status.textContent = 'Saved.';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });

  document.getElementById('add-domain-btn').addEventListener('click', async () => {
    const raw = document.getElementById('domain-input').value.trim();
    if (!raw) return;
    const url = raw.includes('://') ? raw : `https://${raw}`;
    try {
      await addDomainToBlacklist(url, localStore);
      document.getElementById('domain-input').value = '';
      await renderList();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('domain-list').addEventListener('click', async (e) => {
    const domain = e.target.dataset.domain;
    if (!domain) return;
    await removeDomainFromBlacklist(domain, localStore);
    await renderList();
  });

  document.getElementById('reset-btn').addEventListener('click', async () => {
    if (!confirm('Reset to default utility list?')) return;
    await resetBlacklist(localStore);
    await renderList();
  });
}

document.addEventListener('DOMContentLoaded', main);
