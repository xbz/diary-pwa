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
    wishlist: [],
    followups: [],
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

// ===== 剪贴板（所有关键内容都能手动复制导出，防止丢失）=====
function copyToClipboard(text, btnEl) {
  const done = () => {
    if (btnEl) {
      const old = btnEl.textContent;
      btnEl.textContent = '✅ 已复制';
      setTimeout(() => { btnEl.textContent = old; }, 1500);
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { alert('复制失败，请手动长按选中文字复制'); }
  document.body.removeChild(ta);
}

// ===== Obsidian URI（仅作为"尝试跳转"的辅助手段，不保证一定成功）=====
function buildObsidianAppendUri(filePath, content) {
  const vault = DATA.settings.vaultName || '';
  const params = new URLSearchParams();
  params.set('vault', vault);
  params.set('file', filePath);
  params.set('content', content);
  params.set('append', 'true');
  return 'obsidian://new?' + params.toString();
}

function tryOpenObsidian(uri) {
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
    li.innerHTML = (topic ? `<span class="tag">${escapeHtml(topic.text.slice(0, 8))}…</span>` : '<span class="tag">随手记</span>') +
      escapeHtml(e.text);
    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== 继续记录（按清单逐项）=====
function unansweredTopicsToday() {
  const list = DATA.entries[todayStr()] || [];
  const answeredIds = new Set(list.map((e) => e.topicId).filter(Boolean));
  return DATA.topics.filter((t) => !answeredIds.has(t.id));
}

function renderCapture() {
  renderCaptureWithOrder(unansweredTopicsToday());
}

function renderCaptureWithOrder(order) {
  const body = document.getElementById('captureBody');
  if (order.length === 0) {
    body.innerHTML = '<p>今天清单上的话题都聊过啦 🎉 要不去 <b>随手记一笔</b> 或者 <b>整理归档</b> 看看？</p>';
    return;
  }
  const topic = order[0];
  body.innerHTML = `
    <div class="progressDots">还剩 ${order.length} 项</div>
    <h2>${escapeHtml(topic.text)}</h2>
    <textarea id="captureText" rows="6" placeholder="说点什么……"></textarea>
    <button class="primary" id="captureSave">保存并下一题</button>
    <button class="secondary" id="captureCopy">📋 复制这段文字</button>
    <button class="secondary" id="captureSkip">跳过这题</button>
  `;
  document.getElementById('captureSave').onclick = () => {
    const text = document.getElementById('captureText').value.trim();
    if (text) addEntry(topic.id, text);
    renderCaptureWithOrder(order.slice(1));
  };
  document.getElementById('captureCopy').onclick = (e) => {
    const text = document.getElementById('captureText').value.trim();
    copyToClipboard(text, e.currentTarget);
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
    const fullHeading = `# ${formatDateHeading(date)}\n\n`;
    box.innerHTML = `
      <h3># ${formatDateHeading(date)}</h3>
      <textarea id="${textId}" rows="6">${escapeHtml(composeDayText(entries))}</textarea>
      <button class="secondary" data-copy="${date}">📋 复制（含标题），粘到 Obsidian 最保险</button>
      <button class="primary" data-send="${date}">尝试跳转 Obsidian 自动写入</button>
      <label class="confirmRow"><input type="checkbox" data-confirm="${date}" /> 我已确认内容写进 Obsidian 了，标记为已归档</label>
    `;
    container.appendChild(box);
  });
  container.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const date = btn.getAttribute('data-copy');
      const textarea = document.getElementById('archiveText_' + date);
      const content = `# ${formatDateHeading(date)}\n\n${textarea.value.trim()}\n\n`;
      copyToClipboard(content, e.currentTarget);
    });
  });
  container.querySelectorAll('[data-send]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const date = btn.getAttribute('data-send');
      const textarea = document.getElementById('archiveText_' + date);
      const content = `# ${formatDateHeading(date)}\n\n${textarea.value.trim()}\n\n`;
      const uri = buildObsidianAppendUri(DATA.settings.diaryFile, content);
      tryOpenObsidian(uri);
      // 注意：不在这里自动标记归档，必须用户手动勾选确认，避免数据静默丢失
    });
  });
  container.querySelectorAll('[data-confirm]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (!cb.checked) return;
      const date = cb.getAttribute('data-confirm');
      if (!confirm('确认这一天的内容已经手动确认写进 Obsidian 了吗？标记后会从待归档列表消失（但本地仍保留一份记录）。')) {
        cb.checked = false;
        return;
      }
      DATA.entries[date].forEach((e) => { e.archived = true; });
      saveData();
      renderArchive();
    });
  });
}

// ===== 回忆故事 =====
let selectedWishId = null;
function renderStory() {
  selectedWishId = null;
  const wishBox = document.getElementById('storyWishlist');
  wishBox.innerHTML = '';
  if (DATA.wishlist.filter((w) => !w.done).length) {
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
  document.getElementById('quickCopy').addEventListener('click', (e) => {
    const text = document.getElementById('quickText').value.trim();
    if (text) copyToClipboard(text, e.currentTarget);
  });

  document.getElementById('storySave').addEventListener('click', () => {
    const title = document.getElementById('storyTitle').value.trim();
    const text = document.getElementById('storyText').value.trim();
    if (!title || !text) { alert('标题和内容都写一下吧'); return; }
    if (selectedWishId) {
      const w = DATA.wishlist.find((x) => x.id === selectedWishId);
      if (w) w.done = true;
    }
    saveData();
    const content = `# ${title}\n\n${text}\n\n`;
    const uri = buildObsidianAppendUri(DATA.settings.storyFile, content);
    tryOpenObsidian(uri);
    showScreen('home');
  });
  document.getElementById('storyCopy').addEventListener('click', (e) => {
    const title = document.getElementById('storyTitle').value.trim();
    const text = document.getElementById('storyText').value.trim();
    if (!title && !text) return;
    copyToClipboard(`# ${title}\n\n${text}\n\n`, e.currentTarget);
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

  document.getElementById('btnDiag').addEventListener('click', () => {
    const out = document.getElementById('diagOutput');
    const totalEntries = Object.values(DATA.entries).reduce((sum, arr) => sum + arr.length, 0);
    const summary = {
      当前入口: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
        ? '主屏幕图标（standalone）' : 'Safari 浏览器标签页',
      总条数: totalEntries,
      按日期统计: Object.fromEntries(Object.keys(DATA.entries).map((d) => [d, DATA.entries[d].length]))
    };
    out.textContent = JSON.stringify(summary, null, 2);
    out.classList.remove('hidden');
  });

  document.getElementById('btnExportAll').addEventListener('click', (e) => {
    copyToClipboard(JSON.stringify(DATA, null, 2), e.currentTarget);
  });

  document.getElementById('btnImportAll').addEventListener('click', () => {
    const text = prompt('粘贴之前导出的完整 JSON 数据（会整体覆盖当前本地数据）：');
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      DATA = parsed;
      saveData();
      alert('导入成功');
      showScreen('home');
    } catch (err) {
      alert('解析失败，确认粘贴的是完整 JSON');
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

  // 不再使用 Service Worker，避免 iOS 上的缓存更新问题；并清理掉之前可能注册过的旧 SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if (window.caches) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
});
