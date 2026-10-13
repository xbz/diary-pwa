// ===== 本地数据模型（全部存在 localStorage，不调用任何网络/AI 接口）=====
const STORAGE_KEY = 'diaryAppData_v1';

const DEFAULT_TOPICS = [
  'AI agent 今天帮你做了哪些事（工作+生活娱乐）',
  '孩子们今天发生的有趣事',
  '跟老公之间发生的有趣事',
  '跟同事之间发生的事',
  '工作上的大事或新进展',
  '生活上的新想法（收纳整理/打扫/购物）',
  '做饭的新创意',
  '早晨遛弯的新鲜事',
  '学习/进步/技能提升',
  '看视频的新感悟'
];

const DEFAULT_WISHLIST = [];
const DEFAULT_FOLLOWUPS = [];

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fallthrough */ }
  }
  return {
    settings: {
      vaultName: '',
      diaryFile: '日记/2026.9-10.md',
      storyFile: '日记/人生故事.md'
    },
    topics: DEFAULT_TOPICS.map((t, i) => ({ id: 't' + i, text: t })),
    wishlist: DEFAULT_WISHLIST.slice(),
    followups: DEFAULT_FOLLOWUPS.slice(),
    entries: {} // { '2026-10-13': [ {id, topicId|null, text, createdAt, archived} ] }
  };
}

let DATA = loadData();

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== Obsidian URI =====
function buildObsidianAppendUri(filePath, content) {
  const vault = DATA.settings.vaultName || '';
  const params = new URLSearchParams();
  params.set('vault', vault);
  params.set('file', filePath);
  params.set('content', content);
  params.set('append', 'true');
  return 'obsidian://new?' + params.toString();
}

function openObsidianUri(uri) {
  window.location.href = uri;
}

// ===== 视图切换 =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  renderScreen(id);
}

function renderScreen(id) {
  if (id === 'home') renderHome();
  if (id === 'capture') renderCapture();
  if (id === 'topics') renderTopics();
  if (id === 'archive') renderArchive();
  if (id === 'story') renderStory();
  if (id === 'followup') renderFollowup();
  if (id === 'settings') renderSettings();
}

// ===== 首页 =====
function renderHome() {
  document.getElementById('todayLabel').textContent = todayLabel();
  const list = DATA.entries[todayStr()] || [];
  document.getElementById('todayCount').textContent = list.length;
  const ul = document.getElementById('todayEntries');
  ul.innerHTML = '';
  list.slice().reverse().forEach((e) => {
    const li = document.createElement('li');
    const topic = DATA.topics.find((t) => t.id === e.topicId);
    li.innerHTML = (topic ? `<span class="tag">${topic.text.slice(0, 8)}…</span>` : '<span class="tag">随手记</span>') +
      escapeHtml(e.text);
    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== 继续记录（按清单逐项）=====
let captureIndex = 0;
function unansweredTopicsToday() {
  const list = DATA.entries[todayStr()] || [];
  const answeredIds = new Set(list.map((e) => e.topicId).filter(Boolean));
  return DATA.topics.filter((t) => !answeredIds.has(t.id));
}

function renderCapture() {
  const remaining = unansweredTopicsToday();
  const body = document.getElementById('captureBody');
  if (remaining.length === 0) {
    body.innerHTML = '<p>今天清单上的话题都聊过啦 🎉 要不去 <b>随手记一笔</b> 或者 <b>整理归档</b> 看看？</p>';
    return;
  }
  const topic = remaining[0];
  body.innerHTML = `
    <div class="progressDots">还剩 ${remaining.length} 项</div>
    <h2>${escapeHtml(topic.text)}</h2>
    <textarea id="captureText" rows="6" placeholder="说点什么……"></textarea>
    <button class="primary" id="captureSave">保存并下一题</button>
    <button class="secondary" id="captureSkip">跳过这题</button>
  `;
  document.getElementById('captureSave').onclick = () => {
    const text = document.getElementById('captureText').value.trim();
    if (text) {
      addEntry(topic.id, text);
    }
    renderCapture();
  };
  document.getElementById('captureSkip').onclick = () => {
    // 临时把这题排到最后：记一个空占位不太好，直接跳过显示下一条
    const rest = remaining.slice(1).concat([topic]);
    renderCaptureWithOrder(rest);
  };
}

function renderCaptureWithOrder(order) {
  const body = document.getElementById('captureBody');
  if (order.length === 0) { renderCapture(); return; }
  const topic = order[0];
  body.innerHTML = `
    <div class="progressDots">还剩 ${order.length} 项</div>
    <h2>${escapeHtml(topic.text)}</h2>
    <textarea id="captureText" rows="6" placeholder="说点什么……"></textarea>
    <button class="primary" id="captureSave">保存并下一题</button>
    <button class="secondary" id="captureSkip">跳过这题</button>
  `;
  document.getElementById('captureSave').onclick = () => {
    const text = document.getElementById('captureText').value.trim();
    if (text) addEntry(topic.id, text);
    renderCaptureWithOrder(order.slice(1));
  };
  document.getElementById('captureSkip').onclick = () => {
    renderCaptureWithOrder(order.slice(1).concat([topic]));
  };
}

function addEntry(topicId, text) {
  const key = todayStr();
  if (!DATA.entries[key]) DATA.entries[key] = [];
  DATA.entries[key].push({ id: uid(), topicId: topicId || null, text, createdAt: Date.now(), archived: false });
  saveData();
}

// ===== 待写项查看 =====
function renderTopics() {
  const list = DATA.entries[todayStr()] || [];
  const answeredIds = new Set(list.map((e) => e.topicId).filter(Boolean));
  const ul = document.getElementById('topicList');
  ul.innerHTML = '';
  DATA.topics.forEach((t) => {
    const li = document.createElement('li');
    li.className = 'topicItem' + (answeredIds.has(t.id) ? ' done' : '');
    li.innerHTML = `<span>${escapeHtml(t.text)}</span>`;
    ul.appendChild(li);
  });
}

// ===== 整理归档 =====
function allUnarchivedByDate() {
  const result = {};
  Object.keys(DATA.entries).forEach((date) => {
    const unarch = DATA.entries[date].filter((e) => !e.archived);
    if (unarch.length) result[date] = unarch;
  });
  return result;
}

function formatDateHeading(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${m}月${d}日`;
}

function composeDayText(entries) {
  return entries.map((e) => e.text).join('\n\n');
}

function renderArchive() {
  const byDate = allUnarchivedByDate();
  const container = document.getElementById('archiveList');
  container.innerHTML = '';
  const dates = Object.keys(byDate).sort();
  if (dates.length === 0) {
    container.innerHTML = '<p>没有待归档的内容啦，都整理过了 ✅</p>';
    return;
  }
  dates.forEach((date) => {
    const entries = byDate[date];
    const box = document.createElement('div');
    box.className = 'archiveDay';
    const textId = 'archiveText_' + date;
    box.innerHTML = `
      <h3># ${formatDateHeading(date)}</h3>
      <textarea id="${textId}" rows="6">${escapeHtml(composeDayText(entries))}</textarea>
      <button class="primary" data-send="${date}">发送到 Obsidian</button>
    `;
    container.appendChild(box);
  });
  container.querySelectorAll('[data-send]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const date = btn.getAttribute('data-send');
      const textarea = document.getElementById('archiveText_' + date);
      const heading = `# ${formatDateHeading(date)}\n\n`;
      const content = heading + textarea.value.trim() + '\n\n';
      const uri = buildObsidianAppendUri(DATA.settings.diaryFile, content);
      // 标记为已归档
      DATA.entries[date].forEach((e) => { e.archived = true; });
      saveData();
      openObsidianUri(uri);
      setTimeout(() => renderArchive(), 300);
    });
  });
}

// ===== 回忆故事 =====
let selectedWishId = null;
function renderStory() {
  selectedWishId = null;
  const wishBox = document.getElementById('storyWishlist');
  wishBox.innerHTML = '';
  if (DATA.wishlist.length) {
    const label = document.createElement('div');
    label.className = 'hint';
    label.textContent = '挑一个待写的故事，或者直接在下面写新标题：';
    wishBox.appendChild(label);
  }
  DATA.wishlist.filter((w) => !w.done).forEach((w) => {
    const btn = document.createElement('button');
    btn.className = 'wishBtn';
    btn.textContent = w.topic;
    btn.onclick = () => {
      selectedWishId = w.id;
      document.getElementById('storyTitle').value = w.topic;
      wishBox.querySelectorAll('.wishBtn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    wishBox.appendChild(btn);
  });
  document.getElementById('storyTitle').value = '';
  document.getElementById('storyText').value = '';
}

function renderFollowup() {
  const ul = document.getElementById('followupList');
  ul.innerHTML = '';
  if (DATA.followups.length === 0) {
    ul.innerHTML = '<li>暂时没有待跟进的事儿</li>';
  }
  DATA.followups.forEach((f) => {
    const li = document.createElement('li');
    li.textContent = f.text;
    ul.appendChild(li);
  });
}

// ===== 设置 =====
function renderSettings() {
  document.getElementById('setVault').value = DATA.settings.vaultName;
  document.getElementById('setDiaryFile').value = DATA.settings.diaryFile;
  document.getElementById('setStoryFile').value = DATA.settings.storyFile;

  const ul = document.getElementById('settingsTopics');
  ul.innerHTML = '';
  DATA.topics.forEach((t) => {
    const li = document.createElement('li');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = t.text;
    input.onchange = () => { t.text = input.value; saveData(); };
    const del = document.createElement('button');
    del.textContent = '✕';
    del.onclick = () => {
      DATA.topics = DATA.topics.filter((x) => x.id !== t.id);
      saveData();
      renderSettings();
    };
    li.appendChild(input);
    li.appendChild(del);
    ul.appendChild(li);
  });
}

// ===== 事件绑定 =====
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('todayLabel').textContent = todayLabel();
  renderHome();

  document.querySelectorAll('[data-screen]').forEach((btn) => {
    btn.addEventListener('click', () => showScreen(btn.getAttribute('data-screen')));
  });
  document.querySelectorAll('[data-back]').forEach((btn) => {
    btn.addEventListener('click', () => showScreen('home'));
  });
  document.getElementById('btnSettings').addEventListener('click', () => showScreen('settings'));

  document.getElementById('quickSave').addEventListener('click', () => {
    const text = document.getElementById('quickText').value.trim();
    if (text) {
      addEntry(null, text);
      document.getElementById('quickText').value = '';
      showScreen('home');
    }
  });

  document.getElementById('storySave').addEventListener('click', () => {
    const title = document.getElementById('storyTitle').value.trim();
    const text = document.getElementById('storyText').value.trim();
    if (!title || !text) { alert('标题和内容都写一下吧'); return; }
    const content = `# ${title}\n\n${text}\n\n`;
    const uri = buildObsidianAppendUri(DATA.settings.storyFile, content);
    if (selectedWishId) {
      const w = DATA.wishlist.find((x) => x.id === selectedWishId);
      if (w) w.done = true;
    }
    saveData();
    openObsidianUri(uri);
    showScreen('home');
  });

  document.getElementById('followupAdd').addEventListener('click', () => {
    const text = prompt('新增一条待跟进事项：');
    if (text && text.trim()) {
      DATA.followups.push({ id: uid(), text: text.trim() });
      saveData();
      renderFollowup();
    }
  });

  document.getElementById('topicAdd').addEventListener('click', () => {
    const text = prompt('新增一个待写项：');
    if (text && text.trim()) {
      DATA.topics.push({ id: uid(), text: text.trim() });
      saveData();
      renderSettings();
    }
  });

  document.getElementById('settingsSave').addEventListener('click', () => {
    DATA.settings.vaultName = document.getElementById('setVault').value.trim();
    DATA.settings.diaryFile = document.getElementById('setDiaryFile').value.trim();
    DATA.settings.storyFile = document.getElementById('setStoryFile').value.trim();
    saveData();
    alert('设置已保存');
    showScreen('home');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
