/**
 * Google Calendar Integration (Electron Desktop OAuth)
 * 优先使用 Electron 主进程中的运行时配置，其次回退到构建时注入的 VITE_* 变量。
 */

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''

// 优先级 → Google Calendar 颜色 ID
const PRIORITY_COLORS = { P1: '11', P2: '6', P3: '9', P4: '1' }

// 重复规则
const RECURRENCE_RULES = {
  daily: 'RRULE:FREQ=DAILY',
  weekdays: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'RRULE:FREQ=WEEKLY',
  monthly: 'RRULE:FREQ=MONTHLY',
  yearly: 'RRULE:FREQ=YEARLY',
}

function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI?.startGoogleOAuth
}

export function hasCredentials() {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
}

export async function getGoogleCredentialStatus() {
  if (isElectron() && window.electronAPI?.getGoogleOAuthStatus) {
    try {
      const result = await window.electronAPI.getGoogleOAuthStatus()
      return result || { configured: false, source: 'missing', clientIdPreview: '' }
    } catch {
      return { configured: false, source: 'missing', clientIdPreview: '' }
    }
  }

  return {
    configured: hasCredentials(),
    source: hasCredentials() ? 'build' : 'missing',
    clientIdPreview: GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.slice(0, 12)}...` : '',
  }
}

function getStoredExpiry() {
  const value = localStorage.getItem('gcal_token_expiry')
  return value ? parseInt(value, 10) : 0
}

function setAuthTokens(result) {
  const expiry = Date.now() + ((result.expires_in || 3600) - 60) * 1000
  localStorage.setItem('gcal_token', result.access_token)
  localStorage.setItem('gcal_token_expiry', expiry.toString())
  if (result.refresh_token) localStorage.setItem('gcal_refresh_token', result.refresh_token)
  if (result.email) localStorage.setItem('gcal_email', result.email)
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function requestGoogleAccess() {
  const config = await getGoogleCredentialStatus()
  if (!config.configured) {
    return { success: false, error: 'missing_credentials' }
  }

  if (!isElectron()) {
    return { success: false, error: '当前环境不支持 OAuth，请使用桌面应用版本' }
  }

  const result = await window.electronAPI.startGoogleOAuth({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
  })

  if (result.success && result.access_token) {
    setAuthTokens(result)
  }

  return result
}

export function normalizeGoogleCalendarError(error) {
  const raw = String(error || '').trim()
  const lower = raw.toLowerCase()

  if (!raw) return 'Google Calendar 同步失败，请重试'
  if (raw === 'missing_credentials') return '当前应用未配置 Google OAuth 凭据'
  if (raw === 'token_expired') return '授权已过期，请在设置中重新连接 Google 账户'
  if (raw === 'not_connected') return '请先在设置中连接 Google 账户'
  if (raw === 'insufficient_scope' || lower.includes('insufficient authentication scopes') || lower.includes('insufficient permissions')) {
    return '当前 Google 授权缺少日历写入权限，请在设置中断开后重新连接 Google 账户'
  }
  if (lower.includes('calendar usage limits exceeded')) return 'Google Calendar 配额已达上限，请稍后再试'
  if (lower.includes('forbidden')) return 'Google Calendar 拒绝了这次操作，请检查账户权限后重试'
  return raw
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
}

export function isGoogleConnected() {
  const token = localStorage.getItem('gcal_token')
  const refreshToken = localStorage.getItem('gcal_refresh_token')
  const expiry = getStoredExpiry()

  if (!token && !refreshToken) return false
  if (token && (!expiry || Date.now() < expiry)) return true
  return !!refreshToken
}

export function getGoogleEmail() {
  return localStorage.getItem('gcal_email') || ''
}

async function refreshGoogleAccess() {
  const refreshToken = localStorage.getItem('gcal_refresh_token')
  if (!refreshToken || !window.electronAPI?.refreshGoogleOAuth) {
    return { success: false, error: 'missing_refresh_token' }
  }

  const result = await window.electronAPI.refreshGoogleOAuth({
    refreshToken,
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
  })

  if (result.success && result.access_token) {
    setAuthTokens({ ...result, refresh_token: refreshToken })
  }

  return result
}

async function ensureValidToken() {
  const token = localStorage.getItem('gcal_token')
  const expiry = getStoredExpiry()

  if (token && expiry && Date.now() < expiry) {
    return token
  }

  const refreshed = await refreshGoogleAccess()
  if (refreshed.success && refreshed.access_token) {
    return refreshed.access_token
  }

  revokeGoogleAccess()
  return null
}

// ─── 单次 API 调用 ───────────────────────────────────────────────────────────

async function callApi(path, method, body) {
  const token = await ensureValidToken()
  if (!token) return { success: false, error: 'not_connected' }

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
      const refreshedToken = await refreshGoogleAccess()
      if (refreshedToken.success && refreshedToken.access_token) {
        return callApi(path, method, body)
      }
      revokeGoogleAccess()
      return { success: false, error: 'token_expired' }
    }

    if (res.status === 404) return { success: true }

    const err = await res.json().catch(() => ({}))
    const message = err.error?.message || `HTTP ${res.status}`
    if (
      res.status === 403 &&
      /insufficient authentication scopes|insufficient permissions/i.test(message)
    ) {
      return { success: false, error: 'insufficient_scope' }
    }
    return { success: false, error: message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ─── 构建事件体 ───────────────────────────────────────────────────────────────

function buildEventBody(task) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startDate = task.dueDate || new Date().toISOString().split('T')[0]
  const startTime = task.dueTime || null
  const durationMinutes = task.durationMinutes || null
  const done = task.status === 'completed'

  const body = {
    summary: done ? `✓ ${task.title}` : task.title,
    description: buildDescription(task),
    colorId: done ? '8' : (PRIORITY_COLORS[task.priority] || '1'),
    reminders: { useDefault: false, overrides: done ? [] : [{ method: 'popup', minutes: 30 }] },
    extendedProperties: {
      private: {
        taskflowId: task.id,
        priority: task.priority,
        tags: (task.tags || []).join(','),
      },
    },
  }

  if (startTime && durationMinutes) {
    body.start = { dateTime: `${startDate}T${startTime}:00`, timeZone: tz }
    body.end = { dateTime: `${startDate}T${addMinutes(startTime, durationMinutes)}:00`, timeZone: tz }
  } else {
    body.start = { date: startDate }
    body.end = { date: addDays(startDate, 1) }
  }

  if (!done && task.recurrence && RECURRENCE_RULES[task.recurrence]) {
    body.recurrence = [RECURRENCE_RULES[task.recurrence]]
  }

  return body
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createCalendarEvent(task) {
  return callApi('/calendars/primary/events', 'POST', buildEventBody(task))
}

export async function updateCalendarEvent(eventId, task) {
  if (!eventId) return { success: false, error: 'missing_event_id' }
  return callApi(`/calendars/primary/events/${eventId}`, 'PUT', buildEventBody(task))
}

export async function deleteCalendarEvent(eventId) {
  if (!eventId) return { success: true }
  return callApi(`/calendars/primary/events/${eventId}`, 'DELETE')
}

// ─── 描述文本（含子任务 todo 列表） ──────────────────────────────────────────

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
  if (task.dueTime) lines.push(`开始时间: ${task.dueTime}`)
  if (task.durationMinutes) lines.push(`预计时长: ${task.durationMinutes} 分钟`)
  if (task.recurrence) lines.push(`重复: ${task.recurrence}`)
  lines.push('', '— 由 TaskFlow 创建')

  return lines.join('\n')
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nextHour = Math.floor((total % (24 * 60)) / 60)
  const nextMinute = total % 60
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
