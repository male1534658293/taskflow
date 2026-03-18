/**
 * Google Calendar Integration (Electron Desktop OAuth)
 * 凭据通过 .env.local 的 VITE_GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_SECRET 编译内置
 */

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''

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

export function hasCredentials() {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
}

function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI?.startGoogleOAuth
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function requestGoogleAccess() {
  if (!hasCredentials()) {
    const fakeToken = 'demo_token_' + Date.now()
    localStorage.setItem('gcal_token', fakeToken)
    localStorage.setItem('gcal_token_expiry', (Date.now() + 3600 * 1000).toString())
    localStorage.setItem('gcal_email', 'demo@gmail.com')
    return { success: true, demo: true }
  }

  if (!isElectron()) {
    return { success: false, error: '当前环境不支持 OAuth，请使用桌面应用版本' }
  }

  const result = await window.electronAPI.startGoogleOAuth({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
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
  if (token && !token.startsWith('demo_token_')) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' }).catch(() => {})
  }
  localStorage.removeItem('gcal_token')
  localStorage.removeItem('gcal_token_expiry')
  localStorage.removeItem('gcal_refresh_token')
  localStorage.removeItem('gcal_email')
}

export function isGoogleConnected() {
  const token = localStorage.getItem('gcal_token')
  const expiry = localStorage.getItem('gcal_token_expiry')
  if (!token) return false
  if (expiry && Date.now() > parseInt(expiry)) {
    localStorage.removeItem('gcal_token')
    return false
  }
  return true
}

export function getGoogleEmail() {
  return localStorage.getItem('gcal_email') || ''
}

// ─── 单次 API 调用（带 demo 短路） ────────────────────────────────────────────

async function callApi(path, method, body) {
  const token = localStorage.getItem('gcal_token')
  if (!token) return { success: false, error: 'not_connected' }

  if (token.startsWith('demo_token_') || !hasCredentials()) {
    await new Promise(r => setTimeout(r, 200))
    return { success: true, demo: true, eventId: 'demo_' + Date.now(), eventLink: '' }
  }

  try {
    const opts = {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
    if (body) opts.body = JSON.stringify(body)

    const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, opts)

    if (res.status === 204) return { success: true }

    if (res.ok) {
      const data = await res.json()
      return { success: true, eventId: data.id, eventLink: data.htmlLink }
    }

    if (res.status === 401) {
      revokeGoogleAccess()
      return { success: false, error: 'token_expired' }
    }

    if (res.status === 404) return { success: true } // already deleted

    const err = await res.json().catch(() => ({}))
    return { success: false, error: err.error?.message || `HTTP ${res.status}` }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ─── 构建事件体 ───────────────────────────────────────────────────────────────

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

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** 创建事件，返回 { success, eventId, eventLink } */
export async function createCalendarEvent(task) {
  return callApi('/calendars/primary/events', 'POST', buildEventBody(task))
}

/** 更新事件（全量 PUT） */
export async function updateCalendarEvent(eventId, task) {
  if (!eventId || eventId.startsWith('demo_')) return { success: true }
  return callApi(`/calendars/primary/events/${eventId}`, 'PUT', buildEventBody(task))
}

/** 删除事件 */
export async function deleteCalendarEvent(eventId) {
  if (!eventId || eventId.startsWith('demo_')) return { success: true }
  return callApi(`/calendars/primary/events/${eventId}`, 'DELETE')
}

// ─── 描述文本（含子任务 todo 列表） ──────────────────────────────────────────

function buildDescription(task) {
  const lines = []

  if (task.description) {
    lines.push(task.description, '')
  }

  // 子任务以 checklist 形式展示
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

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function addOneHour(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
