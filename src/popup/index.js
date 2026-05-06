import { RUBRIC_DIMENSIONS } from '../shared/constants.js';

function colorClass(slopIndex) {
  if (slopIndex === null || slopIndex === undefined) return 'gray';
  if (slopIndex < 3.5)  return 'green';
  if (slopIndex <= 6.5) return 'yellow';
  return 'red';
}

function setBadge(slopIndex) {
  const badge = document.getElementById('score-badge');
  const val   = document.getElementById('score-value');
  badge.className = `score-badge ${colorClass(slopIndex)}`;
  val.textContent = slopIndex !== null ? slopIndex.toFixed(1) : '—';
}

function renderRubric(dimensions) {
  const container = document.getElementById('rubric');
  container.innerHTML = '';
  for (const { key, label, positive } of RUBRIC_DIMENSIONS) {
    const value = dimensions[key] ?? 0;
    const pct   = (value / 10) * 100;
    const row   = document.createElement('div');
    row.className = 'rubric-row';
    row.innerHTML = `
      <span class="rubric-label">${label}</span>
      <div class="bar-bg"><div class="bar-fill ${positive ? 'pos' : 'neg'}" style="width:${pct}%"></div></div>
      <span class="rubric-val">${value}</span>
    `;
    container.appendChild(row);
  }
}

function renderIngestion(ingestion) {
  const score = document.getElementById('ingestion-score');
  const hint  = document.getElementById('ingestion-hint');
  if (!ingestion || ingestion.score === null) {
    score.textContent = '—';
    hint.textContent  = 'More pages needed';
    return;
  }
  score.textContent = ingestion.score.toFixed(1);
  hint.textContent  = `${ingestion.entryCount} pages · ${ingestion.windowDays}d`;
}

function showStateMsg(msg) {
  const el = document.getElementById('state-msg');
  el.textContent = msg;
  document.getElementById('explanation').textContent = '';
  document.getElementById('rubric').innerHTML = '';
  setBadge(null);
}

async function main() {
  let data;
  try {
    data = await chrome.runtime.sendMessage({ type: 'GET_POPUP_DATA' });
  } catch {
    showStateMsg('Could not connect to extension.');
    return;
  }

  if (data?.error) { showStateMsg(data.error); return; }

  switch (data?.state) {
    case 'no-tab':
      showStateMsg('No active page.');
      break;
    case 'utility':
      showStateMsg(`${data.domain} is in your utility list.`);
      break;
    case 'unscored':
      showStateMsg('Scoring… re-open to see result.');
      break;
    case 'scored': {
      const { score } = data;
      document.getElementById('state-msg').textContent = '';
      setBadge(score.slopIndex);
      document.getElementById('explanation').textContent = score.explanation;
      renderRubric(score.dimensions);
      break;
    }
    default:
      showStateMsg('Unexpected state.');
  }

  if (data?.ingestion) renderIngestion(data.ingestion);

  document.getElementById('btn-utility').addEventListener('click', async () => {
    const url = data?.url || data?.score?.url;
    if (!url) return;
    await chrome.runtime.sendMessage({ type: 'ADD_TO_BLACKLIST', url });
    window.close();
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

document.addEventListener('DOMContentLoaded', main);
