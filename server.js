const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const expressApp = express();
const PORT = 7777;

// Data path: Electron sets DATA_DIR env var, fallback to local
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'todos.json');

expressApp.use(express.json());
expressApp.use(express.static(path.join(__dirname, 'public')));

// Init data directory and file
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));

const PRIORITY_KARMA = { p1: 40, p2: 30, p3: 20, p4: 10 };

function normalizeComment(comment = {}) {
  return {
    id: comment.id || crypto.randomUUID(),
    author: typeof comment.author === 'string' && comment.author.trim() ? comment.author.trim() : '我',
    text: typeof comment.text === 'string' ? comment.text.trim() : '',
    createdAt: comment.createdAt || new Date().toISOString(),
  };
}

function normalizeTodo(todo = {}) {
  return {
    id: todo.id || crypto.randomUUID(),
    parentId: todo.parentId || null,
    title: todo.title || '新待办',
    description: todo.description || '',
    dueDate: todo.dueDate || null,
    priority: ['p1', 'p2', 'p3', 'p4'].includes(todo.priority) ? todo.priority : 'p3',
    status: todo.status === 'doing' ? 'doing' : 'todo',
    completed: Boolean(todo.completed),
    recurrence: todo.recurrence || null,
    tags: Array.isArray(todo.tags) ? todo.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
    comments: Array.isArray(todo.comments) ? todo.comments.map(normalizeComment).filter(comment => comment.text) : [],
    createdAt: todo.createdAt || new Date().toISOString(),
    completedAt: todo.completedAt || null,
    lastCompletedAt: todo.lastCompletedAt || null,
    completionsCount: Number.isFinite(todo.completionsCount) ? todo.completionsCount : 0,
    reminderMinutes: Number.isFinite(todo.reminderMinutes) ? todo.reminderMinutes : 30,
    sortOrder: Number.isFinite(todo.sortOrder) ? todo.sortOrder : null,
    notified: Boolean(todo.notified),
    gcalEventId: todo.gcalEventId || null,
  };
}

function readTodos() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')).map(normalizeTodo);
  } catch {
    return [];
  }
}
function writeTodos(todos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(todos.map(normalizeTodo), null, 2));
}
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getNextDueDate(dueDateISO, recurrence) {
  const d = new Date(dueDateISO);
  switch (recurrence) {
    case 'daily':    d.setDate(d.getDate() + 1); break;
    case 'weekdays': do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); break;
    case 'weekly':   d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly':  d.setMonth(d.getMonth() + 1); break;
    case 'yearly':   d.setFullYear(d.getFullYear() + 1); break;
    default: return null;
  }
  return d.toISOString();
}
function getNextSortOrder(todos, todoLike = {}) {
  const maxOrder = todos.reduce((max, todo) => {
    const sameParent = (todo.parentId || null) === (todoLike.parentId || null);
    const sameCompleted = Boolean(todo.completed) === Boolean(todoLike.completed);
    const sameStatus = (todo.status || 'todo') === (todoLike.status || 'todo');
    if (!sameParent || !sameCompleted || !sameStatus || !Number.isFinite(todo.sortOrder)) return max;
    return Math.max(max, todo.sortOrder);
  }, 0);
  return maxOrder + 1000;
}

// GET all todos
expressApp.get('/api/todos', (req, res) => res.json(readTodos()));

// POST create todo
expressApp.post('/api/todos', (req, res) => {
  const todos = readTodos();
  const todoDraft = {
    id: crypto.randomUUID(),
    parentId: req.body.parentId || null,
    title: req.body.title || '新待办',
    description: req.body.description || '',
    dueDate: req.body.dueDate || null,
    priority: req.body.priority || 'p3',
    status: req.body.status || 'todo',      // todo | doing
    completed: false,
    recurrence: req.body.recurrence || null, // daily|weekdays|weekly|biweekly|monthly|yearly
    tags: req.body.tags || [],
    comments: req.body.comments || [],
    createdAt: new Date().toISOString(),
    completedAt: null,
    lastCompletedAt: null,
    completionsCount: 0,
    reminderMinutes: req.body.reminderMinutes !== undefined ? req.body.reminderMinutes : 30,
    sortOrder: getNextSortOrder(todos, {
      parentId: req.body.parentId || null,
      completed: false,
      status: req.body.status || 'todo',
    }),
    notified: false,
  };
  const todo = normalizeTodo(todoDraft);
  todos.unshift(todo);
  writeTodos(todos);
  res.json(todo);
});

// PUT update todo
expressApp.put('/api/todos/:id', (req, res) => {
  const todos = readTodos();
  const idx = todos.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  // Handle recurring task completion: reschedule instead of completing
  if (req.body.completed === true && !todos[idx].completed &&
      todos[idx].recurrence && todos[idx].dueDate) {
    const nextDue = getNextDueDate(todos[idx].dueDate, todos[idx].recurrence);
    todos[idx] = normalizeTodo({
      ...todos[idx],
      dueDate: nextDue,
      notified: false,
      lastCompletedAt: new Date().toISOString(),
      completionsCount: (todos[idx].completionsCount || 0) + 1,
    });
    writeTodos(todos);
    return res.json({ ...todos[idx], rescheduled: true });
  }

  const updated = normalizeTodo({ ...todos[idx], ...req.body });
  if (req.body.completed === true && !todos[idx].completed) {
    updated.completedAt = new Date().toISOString();
    updated.completionsCount = (todos[idx].completionsCount || 0) + 1;
  }
  if (req.body.completed === false)
    updated.completedAt = null;
  todos[idx] = updated;
  writeTodos(todos);
  res.json(todos[idx]);
});

// DELETE todo (also deletes sub-tasks)
expressApp.delete('/api/todos/:id', (req, res) => {
  let todos = readTodos();
  const deleteIds = new Set();
  const collect = (id) => {
    deleteIds.add(id);
    todos.filter(t => t.parentId === id).forEach(t => collect(t.id));
  };
  collect(req.params.id);
  todos = todos.filter(t => !deleteIds.has(t.id));
  writeTodos(todos);
  res.json({ success: true, deleted: deleteIds.size });
});

// POST reorder todos
expressApp.post('/api/todos/reorder', (req, res) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
  if (!updates.length) return res.json({ success: true, updated: 0 });

  const updateMap = new Map(updates.map(update => [update.id, update]));
  const todos = readTodos().map(todo => {
    const patch = updateMap.get(todo.id);
    if (!patch) return todo;
    return normalizeTodo({
      ...todo,
      sortOrder: Number.isFinite(patch.sortOrder) ? patch.sortOrder : todo.sortOrder,
      status: patch.status || todo.status,
      completed: patch.completed !== undefined ? patch.completed : todo.completed,
    });
  });

  writeTodos(todos);
  res.json({ success: true, updated: updates.length });
});

// GET upcoming todos for reminder
expressApp.get('/api/todos/upcoming', (req, res) => {
  const todos = readTodos();
  const now = new Date();
  const upcoming = todos.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const due = new Date(t.dueDate);
    const diffMin = (due - now) / 60000;
    return diffMin >= -5 && diffMin <= (t.reminderMinutes || 30);
  });
  res.json(upcoming);
});

function getTodoKarma(todo) {
  const completionUnits = Math.max(todo.completionsCount || 0, todo.completed ? 1 : 0);
  if (!completionUnits) return 0;
  const base = PRIORITY_KARMA[todo.priority] || PRIORITY_KARMA.p3;
  const recurrenceBonus = todo.recurrence ? 10 : 0;
  const subtaskBonus = todo.parentId ? 5 : 0;
  return completionUnits * (base + recurrenceBonus + subtaskBonus);
}

// GET stats
expressApp.get('/api/stats', (req, res) => {
  const todos = readTodos();
  const now = new Date();
  const todayStr = toDateStr(now);
  const last7 = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    last7[toDateStr(d)] = 0;
  }
  todos.forEach(t => {
    if (t.completedAt) {
      const k = toDateStr(new Date(t.completedAt));
      if (last7[k] !== undefined) last7[k]++;
    }
    if (t.lastCompletedAt) {
      const k = toDateStr(new Date(t.lastCompletedAt));
      if (last7[k] !== undefined) last7[k]++;
    }
  });
  const root = todos.filter(t => !t.parentId);
  const todayPending = root.filter(t => !t.completed && t.dueDate && toDateStr(new Date(t.dueDate)) === todayStr).length;
  const todayCompleted = todos.filter(t => {
    if (t.completedAt && toDateStr(new Date(t.completedAt)) === todayStr) return true;
    if (t.lastCompletedAt && toDateStr(new Date(t.lastCompletedAt)) === todayStr) return true;
    return false;
  }).length;
  res.json({
    last7days: last7,
    totalCompleted: todos.filter(t => t.completed).length,
    totalPending: root.filter(t => !t.completed).length,
    totalRecurring: todos.filter(t => t.recurrence && !t.completed).length,
    totalSubtasks: todos.filter(t => t.parentId).length,
    totalComments: todos.reduce((sum, todo) => sum + (todo.comments?.length || 0), 0),
    karmaPoints: todos.reduce((sum, todo) => sum + getTodoKarma(todo), 0),
    todayCompleted,
    todayPending,
    streak: calcStreak(todos),
  });
});

function calcStreak(todos) {
  const completedDays = new Set();
  todos.forEach(t => {
    if (t.completedAt) completedDays.add(toDateStr(new Date(t.completedAt)));
    if (t.lastCompletedAt) completedDays.add(toDateStr(new Date(t.lastCompletedAt)));
  });
  let streak = 0;
  const d = new Date();
  while (completedDays.has(toDateStr(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// Proxy for built-in browser
expressApp.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url' });
  try {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'https:' ? https : http;
    const proxyReq = client.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      timeout: 10000
    }, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      delete headers['x-frame-options'];
      delete headers['content-security-policy'];
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', e => res.status(500).json({ error: e.message }));
    proxyReq.setTimeout(10000, () => { proxyReq.destroy(); res.status(504).end(); });
  } catch(e) { res.status(400).json({ error: 'Invalid URL' }); }
});

// ===== GOOGLE CALENDAR SYNC =====
const GCAL_TOKEN_FILE = path.join(DATA_DIR, 'gcal_token.json');
const GCAL_CREDS_FILE = path.join(DATA_DIR, 'gcal_creds.json');
const GCAL_REDIRECT = 'http://127.0.0.1:7777/auth/google/callback';

function readGcalToken() {
  try { return JSON.parse(fs.readFileSync(GCAL_TOKEN_FILE, 'utf-8')); } catch { return null; }
}
function writeGcalToken(t) { fs.writeFileSync(GCAL_TOKEN_FILE, JSON.stringify(t, null, 2)); }
function readGcalCreds() {
  try { return JSON.parse(fs.readFileSync(GCAL_CREDS_FILE, 'utf-8')); } catch { return null; }
}

function httpsPost(hostname, path2, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: path2, method: 'POST', headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
function httpsGet(hostname, path2, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: path2, method: 'GET', headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject); req.end();
  });
}
function httpsReq(method, hostname, path2, headers, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: path2, method, headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, data: d }); } });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function gcalRefreshToken() {
  const token = readGcalToken(); const creds = readGcalCreds();
  if (!token?.refresh_token || !creds) return null;
  const body = new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, refresh_token: token.refresh_token, grant_type: 'refresh_token' }).toString();
  const r = await httpsPost('oauth2.googleapis.com', '/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body);
  if (r.data.access_token) {
    const nt = { ...token, access_token: r.data.access_token, expires_at: Date.now() + (r.data.expires_in || 3600) * 1000 };
    writeGcalToken(nt); return nt.access_token;
  }
  return null;
}
async function getGcalAccessToken() {
  const t = readGcalToken(); if (!t) return null;
  if (t.expires_at && Date.now() < t.expires_at - 60000) return t.access_token;
  return gcalRefreshToken();
}
async function gcalAPI(method, apiPath, body = null) {
  const at = await getGcalAccessToken(); if (!at) throw new Error('Not authenticated');
  const bodyStr = body ? JSON.stringify(body) : null;
  const headers = { 'Authorization': `Bearer ${at}`, 'Content-Type': 'application/json' };
  if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
  return httpsReq(method, 'www.googleapis.com', apiPath, headers, bodyStr);
}

expressApp.get('/auth/google', (req, res) => {
  const creds = readGcalCreds();
  if (!creds) return res.status(400).send('未配置凭据');
  const p = new URLSearchParams({ client_id: creds.clientId, redirect_uri: GCAL_REDIRECT, response_type: 'code', scope: 'https://www.googleapis.com/auth/calendar', access_type: 'offline', prompt: 'consent' });
  res.redirect(`https://accounts.google.com/o/oauth2/auth?${p}`);
});

expressApp.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.send(`<html><body style="font-family:sans-serif;padding:40px;background:#1a1a1a;color:#fff"><h2>❌ 授权失败</h2><p>${error || 'no code'}</p></body></html>`);
  const creds = readGcalCreds();
  const body = new URLSearchParams({ code, client_id: creds.clientId, client_secret: creds.clientSecret, redirect_uri: GCAL_REDIRECT, grant_type: 'authorization_code' }).toString();
  try {
    const r = await httpsPost('oauth2.googleapis.com', '/token', { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }, body);
    if (r.data.access_token) {
      writeGcalToken({ ...r.data, expires_at: Date.now() + (r.data.expires_in || 3600) * 1000 });
      return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#1a1a1a;color:#fff"><h2>✅ 授权成功！</h2><p>请关闭此窗口，返回应用</p><script>setTimeout(()=>{window.close();},2000)</script></body></html>`);
    }
    res.send(`<p>失败: ${JSON.stringify(r.data)}</p>`);
  } catch(e) { res.status(500).send(e.message); }
});

expressApp.get('/api/gcal/status', (req, res) => {
  const token = readGcalToken(); const creds = readGcalCreds();
  res.json({ connected: Boolean(token?.refresh_token), hasCredentials: Boolean(creds?.clientId && creds?.clientSecret) });
});

expressApp.post('/api/gcal/credentials', (req, res) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) return res.status(400).json({ error: 'Missing credentials' });
  fs.writeFileSync(GCAL_CREDS_FILE, JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }, null, 2));
  res.json({ ok: true });
});

expressApp.delete('/api/gcal/disconnect', (req, res) => {
  if (fs.existsSync(GCAL_TOKEN_FILE)) fs.unlinkSync(GCAL_TOKEN_FILE);
  res.json({ ok: true });
});

expressApp.post('/api/gcal/sync', async (req, res) => {
  try {
    const at = await getGcalAccessToken();
    if (!at) return res.status(401).json({ error: 'Not authenticated' });

    let todos = readTodos();
    const now = new Date();
    const timeMin = new Date(now); timeMin.setDate(timeMin.getDate() - 90);
    const timeMax = new Date(now); timeMax.setDate(timeMax.getDate() + 180);

    const evRes = await gcalAPI('GET', `/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin.toISOString())}&timeMax=${encodeURIComponent(timeMax.toISOString())}&singleEvents=true&maxResults=500&showDeleted=true`);
    if (evRes.status !== 200) return res.status(500).json({ error: 'Failed to fetch events', details: evRes.data });

    const gcalEvents = evRes.data.items || [];
    const gcalEventMap = new Map(gcalEvents.map(e => [e.id, e]));
    const todoByGcalId = new Map(todos.filter(t => t.gcalEventId).map(t => [t.gcalEventId, t]));

    let created = 0, updated = 0, deleted = 0, pushed = 0;

    // Step 1: Sync Google Calendar → app
    for (const ev of gcalEvents) {
      const eventStart = ev.start?.dateTime || ev.start?.date;
      if (!eventStart) continue;
      const eventDate = new Date(eventStart);

      if (ev.status === 'cancelled') {
        if (todoByGcalId.has(ev.id)) {
          todos = todos.filter(t => t.gcalEventId !== ev.id);
          deleted++;
        }
        continue;
      }

      if (todoByGcalId.has(ev.id)) {
        const todo = todoByGcalId.get(ev.id);
        const idx = todos.findIndex(t => t.id === todo.id);
        if (idx !== -1) {
          let patch = {};
          if (ev.summary && ev.summary !== todo.title) patch.title = ev.summary;
          if (Math.abs(eventDate - new Date(todo.dueDate || 0)) > 60000) patch.dueDate = eventDate.toISOString();
          if (Object.keys(patch).length) { todos[idx] = normalizeTodo({ ...todos[idx], ...patch }); updated++; }
        }
      } else {
        todos.unshift(normalizeTodo({
          id: crypto.randomUUID(), title: ev.summary || '(Google日历事件)',
          description: ev.description || '', dueDate: eventDate.toISOString(),
          gcalEventId: ev.id, tags: ['Google日历'],
          sortOrder: getNextSortOrder(todos, {}),
        }));
        created++;
      }
    }

    // Step 2: Push app todos → Google Calendar
    const todosToExport = todos.filter(t => t.dueDate && !t.gcalEventId && !t.completed && !t.parentId);
    for (const todo of todosToExport) {
      const start = new Date(todo.dueDate);
      const end = new Date(start.getTime() + 3600000);
      const r = await gcalAPI('POST', '/calendar/v3/calendars/primary/events', {
        summary: todo.title, description: todo.description || '',
        start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() },
      });
      if (r.status === 200 || r.status === 201) {
        const idx = todos.findIndex(t => t.id === todo.id);
        if (idx !== -1) { todos[idx] = normalizeTodo({ ...todos[idx], gcalEventId: r.data.id }); pushed++; }
      }
    }

    writeTodos(todos);
    res.json({ ok: true, created, updated, deleted, pushed });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Start server function (used by Electron)
function startServer() {
  return new Promise((resolve, reject) => {
    const server = expressApp.listen(PORT, '127.0.0.1', () => {
      console.log(`\n✅ 待办应用已启动！\n🌐 请访问: http://localhost:${PORT}\n`);
      resolve(PORT);
    });
    server.on('error', reject);
  });
}

// Run directly
if (require.main === module) startServer();

module.exports = { startServer };
