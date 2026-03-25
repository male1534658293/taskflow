/**
 * Google Calendar Integration (Electron Desktop OAuth)
 * 凭据可在设置界面输入后保存到 localStorage，无需重新构建应用
 */

// ─── 升级清理：清除旧版 demo token，避免升级后状态混乱 ───────────────────────
;(function clearLegacyDemoTokens() {
  try {
    const token = localStorage.getItem('gcal_token')
    if (token && token.startsWith('demo_token_')) {
      localStorage.removeItem('gcal_token')
      localStorage.removeItem('gcal_token_expiry')
      localStorage.removeItem('gcal_email')
    }
  } catch {}
})()

// ─── Credentials (runtime localStorage > compile-time env) ──────────────────

export function getClientId() {
  return localStorage.getItem('gcal_client_id') || import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
}

export function getClientSecret() {
  return localStorage.getItem('gcal_client_secret') || import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''
}

export function hasCredentials() {
  return !!(getClientId() && getClientSecret())
}

export function saveCredentials(clientId, clientSecret) {
  localStorage.setItem('gcal_client_id', clientId.trim())
  localStorage.setItem('gcal_client_secret', clientSecret.trim())
}

export function clearSavedCredentials() {
  localStorage.removeItem('gcal_client_id')
  localStorage.removeItem('gcal_client_secret')
}

// 优先级 → Google Calendar 颜色 ID
const PRIORITY_COLORS = { P1: '11', P2: '6', P3: '9', P4: '1' }

// 重复规则
const RECURRENCE_RULES = {
  daily:    'RRULE:FREQ=DAILY',
  weekdays: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly:   'RRULE:FREQ=WEEKLY',
  monthly:  'RRULE:FREQ=MONTHLY',
  yearly:   'RRULE:FREQ=YEARLY',
}

function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI?.startGoogleOAuth
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function requestGoogleAccess() {
  if (!hasCredentials()) {
    return { success: false, error: '请先在设置中填写 Google OAuth 凭据（Client ID 和 Client Secret）' }
  }

  if (!isElectron()) {
    return { success: false, error: '当前环境不支持 OAuth，请使用桌面应用版本' }
  }

  const result = await window.electronAPI.startGoogleOAuth({
    clientId: getClientId(),
    clientSecret: getClientSecret(),
  })

  if (result.success) {
    const expiry = Date.now() + ((result.expires_in || 3600) - 60) * 1000
    localStorage.setItem('gcal_token', result.access_token)
    localStorage.setItem('gcal_token_expiry', expiry.toString())
    if (result.refresh_token) localStorage.setItem('gcal_refresh_token', result.refresh_token)
    if (result.email) localStorage.setItem('gcal_email', result.email)
  }

  return result
}

export function revokeGoogleAccess() {
  const token = localStorage.getItem('gcal_token')
  if (token) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' }).catch(() => {})
  }
  localStorage.removeItem('gcal_token')
  localStorage.removeItem('gcal_token_expiry')
  localStorage.removeItem('gcal_refresh_token')
  localStorage.removeItem('gcal_email')
  localStorage.removeItem('gcal_sync_token')
}

export function isGoogleConnected() {
  const token = localStorage.getItem('gcal_token')
  if (!token) return false
  const expiry = localStorage.getItem('gcal_token_expiry')
  if (expiry && Date.now() > parseInt(expiry)) {
    // Expired — still consider "connected" if we have a refresh token
    const hasRefresh = !!localStorage.getItem('gcal_refresh_token')
    if (!hasRefresh) {
      localStorage.removeItem('gcal_token')
      return false
    }
  }
  return true
}

export function getGoogleEmail() {
  return localStorage.getItem('gcal_email') || ''
}

// ─── Token auto-refresh ───────────────────────────────────────────────────────

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('gcal_refresh_token')
  if (!refreshToken) return false

  const clientId = getClientId()
  const clientSecret = getClientSecret()
  if (!clientId || !clientSecret) return false

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    })
    const data = await res.json()
    if (data.access_token) {
      const expiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000
      localStorage.setItem('gcal_token', data.access_token)
      localStorage.setItem('gcal_token_expiry', expiry.toString())
      return true
    }
  } catch {}
  return false
}

// ─── API call helper ──────────────────────────────────────────────────────────

let _refreshing = false

async function callApi(path, method = 'GET', body = null) {
  let token = localStorage.getItem('gcal_token')
  if (!token) return { success: false, error: 'not_connected' }

  // Proactive refresh if token is within 2 minutes of expiry
  const expiry = localStorage.getItem('gcal_token_expiry')
  if (expiry && Date.now() > parseInt(expiry) - 120000 && !_refreshing) {
    _refreshing = true
    await refreshAccessToken()
    _refreshing = false
    token = localStorage.getItem('gcal_token')
  }

  const doFetch = async (accessToken) => {
    const opts = {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
    if (body) opts.body = JSON.stringify(body)
    return fetch(`https://www.googleapis.com/calendar/v3${path}`, opts)
  }

  try {
    let res = await doFetch(token)

    // On 401, try refresh once
    if (res.status === 401) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        res = await doFetch(localStorage.getItem('gcal_token'))
      } else {
        revokeGoogleAccess()
        return { success: false, error: 'token_expired' }
      }
    }

    if (res.status === 204) return { success: true }

    if (res.status === 401) {
      revokeGoogleAccess()
      return { success: false, error: 'token_expired' }
    }

    if (res.status === 404) return { success: true }

    if (res.status === 410) {
      // Sync token expired — clear it
      localStorage.removeItem('gcal_sync_token')
      return { success: false, error: 'sync_token_expired' }
    }

    if (res.ok) {
      const data = await res.json()
      // Return full data object so list responses pass through items/nextSyncToken
      return { success: true, ...data, eventId: data.id, eventLink: data.htmlLink }
    }

    const err = await res.json().catch(() => ({}))
    return { success: false, error: err.error?.message || `HTTP ${res.status}` }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ─── CRUD (push to Google) ────────────────────────────────────────────────────

/** 创建事件，返回 { success, eventId, eventLink } */
export async function createCalendarEvent(task) {
  return callApi('/calendars/primary/events', 'POST', buildEventBody(task))
}

/** 更新事件（全量 PUT） */
export async function updateCalendarEvent(eventId, task) {
  if (!eventId) return { success: true }
  return callApi(`/calendars/primary/events/${eventId}`, 'PUT', buildEventBody(task))
}

/** 删除事件 */
export async function deleteCalendarEvent(eventId) {
  if (!eventId) return { success: true }
  return callApi(`/calendars/primary/events/${eventId}`, 'DELETE')
}

// ─── Bidirectional sync: pull from Google ────────────────────────────────────

/**
 * 从 Google Calendar 拉取事件，返回需要处理的变更列表：
 *   gcalDeleted: todoId[]   - 在 Google 中被删除的 TaskFlow 事件
 *   toImport:    todo[]     - 非 TaskFlow 来源的新事件（importExternal=true 时才有）
 *   total:       number     - 本次拉取到的事件数
 */
export async function pullGoogleCalendarEvents(existingTodos, importExternal = false) {
  const syncToken = localStorage.getItem('gcal_sync_token')

  let url
  if (syncToken) {
    // 增量同步
    url = `/calendars/primary/events?syncToken=${encodeURIComponent(syncToken)}`
  } else {
    // 首次全量同步：近 90 天 ~ 未来 365 天
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    url = `/calendars/primary/events?singleEvents=true&maxResults=500&orderBy=startTime`
      + `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
  }

  const result = await callApi(url, 'GET')

  if (!result.success) {
    if (result.error === 'sync_token_expired') {
      // 同步 token 过期，清除后重试完整同步
      localStorage.removeItem('gcal_sync_token')
      return pullGoogleCalendarEvents(existingTodos, importExternal)
    }
    return { success: false, error: result.error, gcalDeleted: [], toImport: [], total: 0 }
  }

  if (result.nextSyncToken) {
    localStorage.setItem('gcal_sync_token', result.nextSyncToken)
  }

  const items = result.items || []
  const gcalDeleted = []
  const toImport = []

  // 建立本地查找表
  const todoById = {}
  const existingGcalEventIds = new Set()
  existingTodos.forEach(t => {
    todoById[t.id] = t
    if (t.gcalEventId) existingGcalEventIds.add(t.gcalEventId)
  })

  for (const event of items) {
    const taskflowId = event.extendedProperties?.private?.taskflowId
    const isCancelled = event.status === 'cancelled'

    if (taskflowId) {
      // TaskFlow 创建的事件
      const todo = todoById[taskflowId]
      if (todo && isCancelled && todo.gcalEventId) {
        // 在 Google 日历中被删除 → 清除本地 gcalEventId
        gcalDeleted.push(taskflowId)
      }
    } else if (importExternal && !isCancelled) {
      // 非 TaskFlow 来源的外部事件
      if (!existingGcalEventIds.has(event.id)) {
        const newTodo = convertEventToTodo(event)
        if (newTodo) toImport.push(newTodo)
      }
    }
  }

  return { success: true, gcalDeleted, toImport, total: items.length }
}

// ─── Convert Google Calendar event → TaskFlow todo ───────────────────────────

function convertEventToTodo(event) {
  const title = event.summary
  if (!title) return null

  let dueDate = null
  let dueTime = null

  if (event.start?.dateTime) {
    const dt = new Date(event.start.dateTime)
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    dueDate = `${y}-${m}-${d}`
    dueTime = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  } else if (event.start?.date) {
    dueDate = event.start.date
  }

  return {
    id: `gcal_import_${event.id}`,
    title,
    status: 'todo',
    priority: 'P4',
    tags: ['Google日历'],
    dueDate,
    dueTime,
    recurrence: null,
    description: event.description || '',
    subtasks: [],
    comments: [],
    gcalEventId: event.id,
    gcalEventLink: event.htmlLink || null,
    createdAt: new Date().toISOString(),
  }
}

// ─── Build event body ─────────────────────────────────────────────────────────

function buildEventBody(task) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startDate = task.dueDate || new Date().toISOString().split('T')[0]
  const startTime = task.dueTime || '09:00'
  const endTime = addOneHour(startTime)
  const done = task.status === 'completed'

  const body = {
    summary: done ? `✓ ${task.title}` : task.title,
    description: buildDescription(task),
    colorId: done ? '8' : (PRIORITY_COLORS[task.priority] || '1'),
    start: { dateTime: `${startDate}T${startTime}:00`, timeZone: tz },
    end:   { dateTime: `${startDate}T${endTime}:00`, timeZone: tz },
    reminders: { useDefault: false, overrides: done ? [] : [{ method: 'popup', minutes: 30 }] },
    extendedProperties: {
      private: {
        taskflowId: task.id,
        priority: task.priority,
        tags: (task.tags || []).join(','),
      },
    },
  }

  if (!done && task.recurrence && RECURRENCE_RULES[task.recurrence]) {
    body.recurrence = [RECURRENCE_RULES[task.recurrence]]
  }

  return body
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDescription(task) {
  const lines = []

  if (task.description) {
    lines.push(task.description, '')
  }

  if (task.subtasks?.length) {
    lines.push('📋 子任务清单：')
    task.subtasks.forEach(s => lines.push(`  ${s.done ? '☑' : '☐'} ${s.title}`))
    const done = task.subtasks.filter(s => s.done).length
    lines.push(`  (${done}/${task.subtasks.length} 已完成)`)
    lines.push('')
  }

  lines.push(`优先级: ${task.priority}`)
  if (task.tags?.length) lines.push(`标签: ${task.tags.map(t => `#${t}`).join(' ')}`)
  if (task.recurrence) lines.push(`重复: ${task.recurrence}`)
  lines.push('', '— 由 TaskFlow 创建')

  return lines.join('\n')
}

function addOneHour(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
