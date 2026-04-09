/* ===================== SECTION: CONFIG ===================== */
const _API_BASE=(function(){
  const id='pwmvfujxrfzzvsvnkkax';
  return 'https://'+id+'.supabase.co';
})();
const _AK=(function(){
  const p=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9','eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3bXZmdWp4cmZ6enZzdm5ra2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjcwMTMsImV4cCI6MjA5MDEwMzAxM30','PCBsHT-D0MTREOf3zdw2ICxQoHnLa6Ax4rZfvIEVlcA'];
  return p.join('.');
})();

let _sessionToken = null;

/* ===================== SECTION: BACKEND API HELPERS ===================== */
const _H = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _AK, 'apikey': _AK });

async function parseApiResponse(res, fallbackMessage) {
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || fallbackMessage };
  }
  if (!res.ok) throw new Error(data.error || fallbackMessage);
  return data;
}

async function apiAuth(action, email, password, username) {
  const res = await fetch(_API_BASE + '/functions/v1/iai-auth', {
    method: 'POST', headers: _H(),
    body: JSON.stringify({ action, email, password, username, sessionToken: _sessionToken }),
  });
  return parseApiResponse(res, 'Auth error');
}

async function apiData(action, extra = {}) {
  const res = await fetch(_API_BASE + '/functions/v1/iai-data', {
    method: 'POST', headers: _H(),
    body: JSON.stringify({ action, sessionToken: _sessionToken, ...extra }),
  });
  try {
    return await parseApiResponse(res, 'Data error');
  } catch (error) {
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    throw error;
  }
}

async function apiAdmin(action, extra = {}) {
  const res = await fetch(_API_BASE + '/functions/v1/iai-admin', {
    method: 'POST', headers: _H(),
    body: JSON.stringify({ action, sessionToken: _sessionToken, ...extra }),
  });
  try {
    return await parseApiResponse(res, 'Admin error');
  } catch (error) {
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    throw error;
  }
}

/* ===================== SECTION: PLANS DATA ===================== */
const PLANS = [
  { id: 'dirt', name: 'Dirt', icon: '🟫', msgs: 25, inr: 00, usd: 000, features: ['25 messages/day', 'Basic AI responses', '1 chat at a time', 'Community support'], popular: false },
  { id: 'stone', name: 'Stone', icon: '🪨', msgs: 50, inr: 49, usd: 0.53, features: ['50 messages/day', 'Faster responses', '5 chats', 'Code highlighting', 'Priority queue'], popular: true },
  { id: 'obsidian', name: 'Obsidian', icon: '🖤', msgs: 80, inr: 99, usd: 1.08, features: ['80 messages/day', 'Advanced code gen', '15 chats', 'Export chats', 'Priority support'], popular: false },
  { id: 'bedrock', name: 'Bedrock', icon: '💎', msgs: 150, inr: 199, usd: 2.16, features: ['150 messages/day', 'Unlimited chats', 'GPT-level answers', 'API access', '24/7 support', 'Early features'], popular: false }
];

/* ===================== SECTION: STATE ===================== */
let currentUser = null, currentChatId = null, authMode = 'login', adminSubTab = 'users', sidebarCollapsed = false, isStreaming = false;

function getChatUrl() {
  return _API_BASE + '/functions/v1/chat';
}

async function requestChat(messages) {
  const payload = JSON.stringify({ messages, sessionToken: _sessionToken });
  const res = await fetch(getChatUrl(), {
    method: 'POST',
    headers: _H(),
    cache: 'no-store',
    body: payload,
  });
  if (!res.ok) { const msg = await res.text().catch(() => ''); throw new Error(msg || ('API error ' + res.status)); }
  if (!res.body) throw new Error('Empty AI response');
  return res;
}

function todayKey() { return new Date().toISOString().slice(0, 10); }

/* ===================== SECTION: SIDEBAR ===================== */
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
  document.getElementById('sidebarToggle').textContent = sidebarCollapsed ? '›' : '‹';
}
function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebarOverlay').classList.add('show');
}
function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ===================== SECTION: AUTH (via Backend) ===================== */
function switchAuthTab(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-box .tabs button').forEach((b, i) => b.classList.toggle('active', i === (mode === 'login' ? 0 : 1)));
  document.getElementById('usernameField').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('authBtn').textContent = mode === 'login' ? 'Login' : 'Sign Up';
  document.getElementById('authError').textContent = '';
}

async function handleAuth(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim().toLowerCase();
  const pass = document.getElementById('authPassword').value;
  const uname = document.getElementById('authUsername').value.trim();
  const err = document.getElementById('authError');
  const btn = document.getElementById('authBtn');
  err.textContent = '';
  btn.disabled = true; btn.textContent = 'Please wait...';

  try {
    if (authMode === 'signup' && !uname) throw new Error('Username required');
    if (pass.length < 6) throw new Error('Password must be at least 6 characters');

    if (authMode === 'signup') {
      const data = await apiAuth('signup', email, pass, uname);
      _sessionToken = data.sessionToken;
      loginAs(data.user);
    } else {
      const data = await apiAuth('login', email, pass);
      _sessionToken = data.sessionToken;
      loginAs(data.user);
    }
  } catch (ex) {
    console.error(ex);
    err.textContent = ex.message || 'Connection error. Please try again.';
  } finally {
    if (!currentUser) {
      btn.disabled = false;
      btn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
    }
  }
}

function loginAs(user) {
  currentUser = user;
  localStorage.setItem('iai_session', JSON.stringify({ token: _sessionToken }));
  // Admin UI — only show if server says isAdmin
  const adminBtn = document.getElementById('adminNavBtn');
  const adminSection = document.getElementById('adminSection');
  if (adminBtn) adminBtn.style.display = user.isAdmin === true ? 'flex' : 'none';
  if (adminSection) adminSection.style.display = user.isAdmin === true ? '' : 'none';
  showMain();
}

function logout() {
  if (_sessionToken) {
    fetch(_API_BASE + '/functions/v1/iai-auth', {
      method: 'POST', headers: _H(),
      body: JSON.stringify({ action: 'logout', sessionToken: _sessionToken }),
    }).catch(() => {});
  }
  currentUser = null; currentChatId = null; _sessionToken = null;
  localStorage.removeItem('iai_session');
  document.getElementById('authScreen').classList.add('active');
  document.getElementById('mainScreen').classList.remove('active');
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  document.getElementById('authUsername').value = '';
  switchAuthTab('login');
  document.getElementById('authBtn').disabled = false;
  document.getElementById('authBtn').textContent = 'Login';
  closeMobileSidebar();
}

async function checkSession() {
  const s = localStorage.getItem('iai_session');
  if (!s) return;
  try {
    const parsed = JSON.parse(s);
    if (!parsed.token) { localStorage.removeItem('iai_session'); return; }
    _sessionToken = parsed.token;
    const data = await apiAuth('session', '', '');
    if (data.success) loginAs(data.user);
    else { _sessionToken = null; localStorage.removeItem('iai_session'); }
  } catch (e) {
    console.error('Session check failed:', e);
    _sessionToken = null;
    localStorage.removeItem('iai_session');
  }
}

/* ===================== SECTION: MAIN NAVIGATION ===================== */
function showMain() {
  document.getElementById('authScreen').classList.remove('active');
  document.getElementById('mainScreen').classList.add('active');
  updateUserUI();
  switchTab('dashboard');
}

function switchTab(tab) {
  if (tab === 'admin' && (!currentUser || !currentUser.isAdmin)) return;
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.getElementById('tab-' + tab).style.display = '';
  document.querySelectorAll('.nav-item[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'plans') renderPlans();
  if (tab === 'admin') renderAdmin();
  if (tab === 'chat' && !currentChatId) startNewChat();
  closeMobileSidebar();
}

function updateUserUI() {
  if (!currentUser) return;
  const init = currentUser.username.charAt(0).toUpperCase();
  document.getElementById('sideAvatar').textContent = init;
  document.getElementById('sideName').textContent = currentUser.username;
  document.getElementById('sideEmail').textContent = currentUser.email;
  const plan = PLANS.find(p => p.id === currentUser.plan) || PLANS[0];
  document.getElementById('sidePlan').textContent = plan.icon + ' ' + plan.name + ' • ' + getMsgRemaining() + ' msgs left';
  document.getElementById('dashPlanBadge').textContent = plan.icon + ' ' + plan.name + ' Plan';
}

/* ===================== SECTION: DASHBOARD ===================== */
function getMsgsToday() {
  if (!currentUser) return 0;
  return (currentUser.msgLog[todayKey()] || 0);
}
function getMsgRemaining() {
  const plan = PLANS.find(p => p.id === currentUser.plan) || PLANS[0];
  return Math.max(0, plan.msgs - getMsgsToday());
}

async function renderDashboard() {
  if (!currentUser) return;
  document.getElementById('dashGreeting').textContent = 'Welcome back, ' + currentUser.username + '!';
  document.getElementById('dashHeaderTitle').textContent = 'Dashboard';
  const plan = PLANS.find(p => p.id === currentUser.plan) || PLANS[0];
  const used = getMsgsToday(), rem = getMsgRemaining(), pct = plan.msgs ? Math.round(used / plan.msgs * 100) : 0;

  let totalChats = 0, totalMsgs = 0;
  try {
    const stats = await apiData('get_stats');
    totalChats = stats.totalChats || 0;
    totalMsgs = stats.totalMsgs || 0;
    if (stats.msgLog) currentUser.msgLog = stats.msgLog;
  } catch (e) { console.error(e); }

  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    <div class="stat-card"><div class="label">Messages Today</div><div class="value primary">${used}</div><div class="sub">of ${plan.msgs} limit</div><div class="quota-bar"><div class="fill" style="width:${pct}%;background:${pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warn)' : 'var(--accent)'}"></div></div></div>
    <div class="stat-card"><div class="label">Remaining Today</div><div class="value accent">${rem}</div><div class="sub">messages available</div></div>
    <div class="stat-card"><div class="label">Total Chats</div><div class="value">${totalChats}</div></div>
    <div class="stat-card"><div class="label">Current Plan</div><div class="value warn">${plan.icon} ${plan.name}</div><div class="sub">₹${plan.inr}/mo • $${plan.usd}/mo</div></div>
  `;
  renderChatList();
}

async function renderChatList() {
  const list = document.getElementById('chatList');
  try {
    const chats = await apiData('get_chats');
    if (!chats.length) { list.innerHTML = '<p style="color:var(--fg3);font-size:13px">No chats yet. Start one!</p>'; return; }

    const now = new Date(), todayStr = todayKey();
    const yest = new Date(now); yest.setDate(yest.getDate() - 1); const yestStr = yest.toISOString().slice(0, 10);
    const groups = { Today: [], Yesterday: [], Previous: [] };
    chats.forEach(c => {
      const d = c.updated_at.slice(0, 10);
      if (d === todayStr) groups.Today.push(c);
      else if (d === yestStr) groups.Yesterday.push(c);
      else groups.Previous.push(c);
    });

    let html = '';
    for (const [label, gchats] of Object.entries(groups)) {
      if (!gchats.length) continue;
      html += `<p style="font-size:11px;color:var(--fg3);margin:12px 0 6px;text-transform:uppercase;letter-spacing:1px">${label}</p>`;
      gchats.forEach(c => {
        html += `<div class="chat-item" onclick="openChat('${c.id}')"><div class="ci-left"><div class="ci-title">${esc(c.title)}</div><div class="ci-meta">Chat</div></div><button class="ci-del" onclick="event.stopPropagation();deleteChat('${c.id}')">Delete</button></div>`;
      });
    }
    list.innerHTML = html;
  } catch (e) { console.error(e); list.innerHTML = '<p style="color:var(--fg3)">Error loading chats</p>'; }
}

/* ===================== SECTION: CHAT SYSTEM ===================== */
async function startNewChat() {
  const id = 'chat_' + Date.now();
  try {
    await apiData('create_chat', { chatId: id, title: 'New Chat' });
  } catch (e) { console.error(e); }
  currentChatId = id;
  switchTab('chat');
  renderChat();
}

function openChat(id) {
  currentChatId = id;
  switchTab('chat');
  renderChat();
}

async function deleteChat(id) {
  if (!confirm('Delete this chat?')) return;
  try {
    await apiData('delete_chat', { chatId: id });
  } catch (e) { console.error(e); }
  if (currentChatId === id) currentChatId = null;
  renderDashboard();
}

async function renderChat() {
  if (!currentChatId) return;
  try {
    const data = await apiData('get_messages', { chatId: currentChatId });
    document.getElementById('chatTitleBar').textContent = data.chat.title;

    const container = document.getElementById('chatMessages');
    const plan = PLANS.find(p => p.id === currentUser.plan) || PLANS[0];
    document.getElementById('quotaInfo').textContent = `${plan.icon} ${plan.name} Plan • ${getMsgRemaining()} of ${plan.msgs} messages remaining today`;

    let html = '';
    data.messages.forEach(m => {
      const parsed = m.role === 'assistant' ? renderMD(m.content) : esc(m.content);
      html += `<div class="msg ${m.role}"><div class="msg-avatar">${m.role === 'user' ? '👤' : '⚡'}</div><div class="msg-body"><div class="msg-role">${m.role === 'user' ? 'You' : 'Infamous AI'}</div><div class="msg-content">${parsed}</div></div></div>`;
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
    addCopyButtons();
  } catch (e) { console.error(e); }
}

function handleChatKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }

function setStreamingState(streaming) {
  isStreaming = streaming;
  const btn = document.getElementById('sendBtn');
  const input = document.getElementById('chatInput');
  btn.disabled = streaming;
  btn.textContent = streaming ? '⏳ Wait...' : 'Send';
  input.disabled = streaming;
  if (streaming) input.style.opacity = '0.5';
  else { input.style.opacity = '1'; input.focus(); }
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || isStreaming) return;
  if (getMsgRemaining() <= 0) { alert('Daily message limit reached! Upgrade your plan.'); return; }

  setStreamingState(true);

  try {
    const result = await apiData('send_message', { chatId: currentChatId, content: text });
    currentUser.msgLog = currentUser.msgLog || {};
    currentUser.msgLog[todayKey()] = result.msgsUsed || ((currentUser.msgLog[todayKey()] || 0) + 1);
  } catch (e) {
    console.error(e);
    if (e.message.includes('limit')) { alert(e.message); setStreamingState(false); return; }
  }

  input.value = ''; input.style.height = 'auto';
  await renderChat();

  const container = document.getElementById('chatMessages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'msg assistant'; typingDiv.id = 'typing-msg';
  typingDiv.innerHTML = '<div class="msg-avatar">⚡</div><div class="msg-body"><div class="msg-role">Infamous AI</div><div class="msg-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>';
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const allMsgs = await apiData('get_chat_history', { chatId: currentChatId });
    const res = await requestChat(allMsgs);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let assistant = '';

    const placeholder = await apiData('create_ai_placeholder', { chatId: currentChatId });
    const assistantMsgId = placeholder.msgId;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = dec.decode(value);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (d === '[DONE]') continue;
        try { const j = JSON.parse(d); const delta = j.choices?.[0]?.delta?.content; if (delta) assistant += delta; } catch { }
      }
      const typEl = document.getElementById('typing-msg');
      if (typEl) {
        const contentEl = typEl.querySelector('.msg-content');
        if (contentEl) contentEl.innerHTML = renderMD(assistant);
        container.scrollTop = container.scrollHeight;
      }
    }

    await apiData('save_ai_response', { chatId: currentChatId, msgId: assistantMsgId, content: assistant || 'No response generated.' });
  } catch (err) {
    const msg = err instanceof Error && err.message ? err.message : 'Please try again.';
    try { await apiData('save_ai_response', { chatId: currentChatId, content: 'Sorry, I could not reach the AI right now. ' + msg }); } catch (e2) { console.error(e2); }
  }
  await renderChat();
  setStreamingState(false);
  updateUserUI();
}

/* ===================== SECTION: PLANS ===================== */
function renderPlans() {
  const grid = document.getElementById('plansGrid');
  grid.innerHTML = PLANS.map(p => {
    const isCurrent = currentUser.plan === p.id;
    const badge = isCurrent ? '<div class="badge current-badge">Current</div>' : p.popular ? '<div class="badge popular-badge">Popular</div>' : '';
    return `<div class="plan-card ${isCurrent ? 'current' : ''}">
      ${badge}
      <div class="plan-icon">${p.icon}</div>
      <h3>${p.name}</h3>
      <div class="plan-msgs">${p.msgs} messages/day</div>
      <div class="plan-price">₹${p.inr}<span style="font-size:14px;color:var(--fg3)">/mo</span></div>
      <div class="plan-price-usd">~$${p.usd}/mo</div>
      <ul class="plan-features">${p.features.map(f => '<li>' + f + '</li>').join('')}</ul>
      <button class="plan-btn ${isCurrent ? 'plan-btn-current' : 'plan-btn-select'}" ${isCurrent ? 'disabled' : 'onclick="showQR(\'' + p.id + '\')"'}>${isCurrent ? '✓ Current Plan' : 'Select Plan'}</button>
    </div>`;
  }).join('');
}

function showQR(planId) {
  const plan = PLANS.find(p => p.id === planId);
  document.getElementById('qrPlanName').textContent = 'Upgrade to ' + plan.name;
  document.getElementById('qrPlanPrice').textContent = `Pay ₹${plan.inr} (~$${plan.usd}) to upgrade`;
  document.getElementById('qrModal').classList.add('show');
}
function closeQR() { document.getElementById('qrModal').classList.remove('show'); }

/* ===================== SECTION: ADMIN PANEL (Server-validated) ===================== */
function switchAdminTab(tab) {
  adminSubTab = tab;
  document.querySelectorAll('.admin-tabs button').forEach((b, i) => {
    const tabs = ['users', 'chats', 'logs'];
    b.classList.toggle('active', tabs[i] === tab);
  });
  ['users', 'chats', 'logs'].forEach(t => {
    document.getElementById('adminTab-' + t).style.display = t === tab ? '' : 'none';
  });
  renderAdmin();
}

async function renderAdmin() {
  if (!currentUser || !currentUser.isAdmin) return;

  try {
    const data = await apiAdmin('get_all_data');
    const { users: allUsers, chats: allChats, messages: allMessages, logs } = data;

    const totalMsgsAll = allMessages.length;
    const totalMsgsToday = allUsers.reduce((s, u) => s + ((u.msg_log || {})[todayKey()] || 0), 0);
    const totalChatsAll = allChats.length;

    document.getElementById('adminStats').innerHTML = `
      <div class="admin-stat"><div class="as-val">${allUsers.length}</div><div class="as-label">Total Users</div></div>
      <div class="admin-stat"><div class="as-val">${totalMsgsToday}</div><div class="as-label">Msgs Today</div></div>
      <div class="admin-stat"><div class="as-val">${totalChatsAll}</div><div class="as-label">Total Chats</div></div>
      <div class="admin-stat"><div class="as-val">${totalMsgsAll}</div><div class="as-label">Total Messages</div></div>
      ${PLANS.map(p => { const c = allUsers.filter(u => u.plan === p.id).length; return `<div class="admin-stat"><div class="as-val">${c}</div><div class="as-label">${p.icon} ${p.name}</div></div>`; }).join('')}
    `;

    document.getElementById('adminUsersBody').innerHTML = allUsers.map(u => {
      const userChats = allChats.filter(c => c.user_email === u.email);
      const userMsgs = allMessages.filter(m => userChats.some(c => c.id === m.chat_id));
      const plan = PLANS.find(p => p.id === u.plan) || PLANS[0];
      const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A';
      const msgsToday = (u.msg_log || {})[todayKey()] || 0;
      const planOptions = PLANS.map(p => `<option value="${p.id}" ${p.id === u.plan ? 'selected' : ''}>${p.icon} ${p.name}</option>`).join('');
      return `<tr>
        <td><strong>${esc(u.username)}</strong></td>
        <td>${esc(u.email)}</td>
        <td>${plan.icon} ${plan.name}</td>
        <td><select class="admin-plan-select" onchange="adminChangePlan('${u.email}',this.value)">${planOptions}</select></td>
        <td>${msgsToday}/${plan.msgs}</td>
        <td>${userChats.length}</td>
        <td>${userMsgs.length}</td>
        <td>${joined}</td>
      </tr>`;
    }).join('');

    const chatsContainer = document.getElementById('adminChatsContainer');
    let chatsHtml = '';
    allUsers.forEach(u => {
      const userChats = allChats.filter(c => c.user_email === u.email);
      if (!userChats.length) return;
      userChats.forEach(chat => {
        const chatMsgs = allMessages.filter(m => m.chat_id === chat.id);
        if (!chatMsgs.length) return;
        chatsHtml += `<div class="admin-chat-viewer">
          <h4>👤 ${esc(u.username)} — "${esc(chat.title)}" <span style="font-size:11px;color:var(--fg3);font-weight:400">(${chatMsgs.length} msgs)</span></h4>`;
        chatMsgs.forEach(m => {
          const cls = m.role === 'user' ? 'user-msg' : 'ai-msg';
          const role = m.role === 'user' ? u.username : 'Infamous AI';
          chatsHtml += `<div class="admin-chat-msg ${cls}"><div class="acm-role">${esc(role)}</div>${esc(m.content).slice(0, 300)}${m.content.length > 300 ? '...' : ''}</div>`;
        });
        chatsHtml += `</div>`;
      });
    });
    chatsContainer.innerHTML = chatsHtml || '<p style="color:var(--fg3);font-size:13px">No chats yet.</p>';

    const logsContainer = document.getElementById('adminLogsContainer');
    if (!logs.length) { logsContainer.innerHTML = '<p style="color:var(--fg3);font-size:13px">No activity yet.</p>'; return; }
    logsContainer.innerHTML = logs.map(l => {
      const time = new Date(l.created_at).toLocaleString();
      const typeClass = { 'signup': 'log-type-signup', 'login': 'log-type-login', 'message': 'log-type-message', 'plan': 'log-type-plan' }[l.type] || '';
      return `<div class="log-entry"><span class="log-time">${time}</span><span class="log-type ${typeClass}">${l.type}</span><span><strong>${esc(l.username)}</strong> — ${esc(l.detail)}</span></div>`;
    }).join('');

  } catch (e) {
    console.error('Admin render error:', e);
    document.getElementById('adminStats').innerHTML = '<p style="color:var(--danger)">Access denied or error loading admin data.</p>';
  }
}

async function adminChangePlan(email, newPlan) {
  if (!currentUser || !currentUser.isAdmin) return;
  try {
    await apiAdmin('change_plan', { targetEmail: email, newPlan });
    if (currentUser.email === email) { currentUser.plan = newPlan; updateUserUI(); }
    renderAdmin();
  } catch (e) { console.error(e); alert('Failed to change plan: ' + e.message); }
}

/* ===================== SECTION: UTILS ===================== */
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renderMD(text) {
  try {
    marked.setOptions({ highlight: (code, lang) => { try { return lang ? hljs.highlight(code, { language: lang }).value : hljs.highlightAuto(code).value } catch { return code } } });
    return marked.parse(text);
  } catch { return esc(text); }
}

function addCopyButtons() {
  document.querySelectorAll('.msg-content pre').forEach(pre => {
    if (pre.querySelector('.copy-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-btn'; btn.textContent = 'Copy';
    btn.onclick = () => { navigator.clipboard.writeText(pre.textContent.replace('Copy', '').trim()); btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); };
    pre.style.position = 'relative'; pre.appendChild(btn);
  });
}

/* ===================== SECTION: INIT ===================== */
checkSession();
