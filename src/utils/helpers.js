export const TASK_DURATION_OPTIONS = [
  { value: null, label: '无时长' },
  { value: 15, label: '15 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 45, label: '45 分钟' },
  { value: 60, label: '1 小时' },
  { value: 90, label: '1.5 小时' },
  { value: 120, label: '2 小时' },
]

const ZH_DIGIT = {
  '零': 0, '〇': 0,
  '一': 1, '二': 2, '两': 2, '俩': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
}

function parseChineseNumber(token) {
  if (!token) return null
  if (/^\d+$/.test(token)) return parseInt(token, 10)

  const normalized = token.replace(/[俩两]/g, '二')
  if (normalized === '十') return 10
  if (normalized.includes('十')) {
    const [tenPart, onePart] = normalized.split('十')
    const tens = tenPart ? (ZH_DIGIT[tenPart] ?? parseInt(tenPart, 10)) : 1
    const ones = onePart ? parseChineseNumber(onePart) : 0
    if (Number.isNaN(tens) || Number.isNaN(ones)) return null
    return tens * 10 + ones
  }

  const digits = [...normalized].map(ch => {
    if (ZH_DIGIT[ch] !== undefined) return String(ZH_DIGIT[ch])
    if (/\d/.test(ch)) return ch
    return ''
  }).join('')

  return digits ? parseInt(digits, 10) : null
}

function applyMeridiem(hour, meridiem) {
  if (!meridiem) return hour
  if (/上午/.test(meridiem)) return hour === 12 ? 0 : hour
  if (/中午/.test(meridiem)) return hour >= 11 ? hour : hour + 12
  if (/(下午|晚上|傍晚)/.test(meridiem)) return hour < 12 ? hour + 12 : hour
  return hour
}

function applyImplicitWorkHour(hour, explicitMeridiem) {
  if (explicitMeridiem) return hour
  if (hour >= 1 && hour <= 7) return hour + 12
  return hour
}

function parseTimeToken(title) {
  const hhmmMatch = title.match(/\b(\d{1,2}):(\d{2})\b/)
  if (hhmmMatch) {
    const rawHour = parseInt(hhmmMatch[1], 10)
    const hour = applyImplicitWorkHour(rawHour, false)
    return {
      dueTime: `${String(hour).padStart(2, '0')}:${hhmmMatch[2]}`,
      raw: hhmmMatch[0],
    }
  }

  const zhTimeMatch = title.match(/(上午|中午|下午|晚上|傍晚)?\s*([零〇一二两俩三四五六七八九十\d]{1,3})\s*点(?:(半)|\s*([零〇一二两俩三四五六七八九十\d]{1,3})\s*分?)?/)
  if (zhTimeMatch) {
    let hour = parseChineseNumber(zhTimeMatch[2])
    if (hour !== null && hour >= 0 && hour <= 23) {
      hour = applyMeridiem(hour, zhTimeMatch[1])
      hour = applyImplicitWorkHour(hour, !!zhTimeMatch[1])
      const minute = zhTimeMatch[3] ? 30 : (parseChineseNumber(zhTimeMatch[4]) ?? 0)
      if (minute >= 0 && minute <= 59) {
        return {
          dueTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          raw: zhTimeMatch[0],
        }
      }
    }
  }

  const ampmMatch = title.match(/\b(\d{1,2})(am|pm)\b/i)
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10)
    const ampm = ampmMatch[2].toLowerCase()
    if (ampm === 'pm' && hour !== 12) hour += 12
    if (ampm === 'am' && hour === 12) hour = 0
    return {
      dueTime: `${String(hour).padStart(2, '0')}:00`,
      raw: ampmMatch[0],
    }
  }

  return null
}

function parseDurationToken(title) {
  const hourMinuteMatch = title.match(/(\d+(?:\.\d+)?)\s*(小时|小時|hours?|hrs?|hr|h)(?![A-Za-z])/i)
  if (hourMinuteMatch) {
    return {
      durationMinutes: Math.round(parseFloat(hourMinuteMatch[1]) * 60),
      raw: hourMinuteMatch[0],
    }
  }

  if (/半小时|半個小时|半小時/i.test(title)) {
    const raw = title.match(/半小时|半個小时|半小時/i)?.[0]
    return { durationMinutes: 30, raw }
  }

  const minuteMatch = title.match(/(\d+)\s*(分钟|分鐘|minutes?|mins?|min)(?![A-Za-z])/i)
  if (minuteMatch) {
    return {
      durationMinutes: parseInt(minuteMatch[1], 10),
      raw: minuteMatch[0],
    }
  }

  return null
}

export function getKnownTags(todos = []) {
  return [...new Set(
    todos
      .flatMap(todo => todo.tags || [])
      .map(tag => String(tag || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function getActiveTagToken(input = '', cursor = input.length) {
  const safeCursor = Math.max(0, Math.min(cursor, input.length))
  const beforeCursor = input.slice(0, safeCursor)
  const match = beforeCursor.match(/(^|\s)([#@])([\u4e00-\u9fa5\w-]*)$/)
  if (!match) return null
  return {
    marker: match[2],
    query: match[3] || '',
    start: safeCursor - match[3].length - 1,
    end: safeCursor,
  }
}

export function applyTagSuggestion(input = '', token, tag) {
  if (!token || !tag) return input
  const before = input.slice(0, token.start)
  const after = input.slice(token.end)
  const spacer = after.startsWith(' ') || !after ? '' : ' '
  return `${before}${token.marker}${tag}${spacer}${after}`.trimEnd()
}

// NLP Parser
export function parseNLP(input) {
  let title = input.trim()
  let priority = 'P4'
  let tags = []
  let dueDate = null
  let dueTime = null
  let recurrence = null
  let durationMinutes = null

  // Parse priority: p1, p2, p3, p4
  const priorityMatch = title.match(/\bp([1-4])\b/i)
  if (priorityMatch) {
    priority = 'P' + priorityMatch[1]
    title = title.replace(priorityMatch[0], '').trim()
  }

  // Parse tags: #tag or @tag
  const tagMatches = title.match(/[#@][\u4e00-\u9fa5\w]+/g)
  if (tagMatches) {
    tags = tagMatches.map(t => t.replace(/^[#@]/, ''))
    title = title.replace(/[#@][\u4e00-\u9fa5\w]+/g, '').trim()
  }

  const timeToken = parseTimeToken(title)
  if (timeToken) {
    dueTime = timeToken.dueTime
    title = title.replace(timeToken.raw, '').trim()
  }

  const durationToken = parseDurationToken(title)
  if (durationToken) {
    durationMinutes = durationToken.durationMinutes
    title = title.replace(durationToken.raw, '').trim()
  }

  // Parse recurrence
  if (/everyday|every\s+day|每天|daily/i.test(title)) {
    recurrence = 'daily'
    title = title.replace(/everyday|every\s+day|每天|daily/i, '').trim()
  } else if (/every\s+weekday|工作日/i.test(title)) {
    recurrence = 'weekdays'
    title = title.replace(/every\s+weekday|工作日/i, '').trim()
  } else if (/every\s+week|每周|weekly/i.test(title)) {
    recurrence = 'weekly'
    title = title.replace(/every\s+week|每周|weekly/i, '').trim()
  }

  // Parse dates
  const now = new Date()
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Helper: get date for target weekday (0=Sun..6=Sat), always future
  function nextWeekday(targetDay) {
    const d = new Date(todayDate)
    let diff = targetDay - d.getDay()
    if (diff <= 0) diff += 7
    d.setDate(d.getDate() + diff)
    return d
  }

  // Chinese weekday map: 一/Mon=1 … 日/Sun=0
  const ZH_DAY = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 }
  const EN_DAY = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

  if (/tomorrow|明天/i.test(title)) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() + 1)
    dueDate = toLocalDateStr(d)
    title = title.replace(/tomorrow|明天/i, '').trim()

  } else if (/后天/i.test(title)) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() + 2)
    dueDate = toLocalDateStr(d)
    title = title.replace(/后天/i, '').trim()

  } else if (/(下周|下星期)([一二三四五六日天])/.test(title)) {
    // 下周一 / 下周五 etc. — always jumps to NEXT week's target day
    const match = title.match(/(下周|下星期)([一二三四五六日天])/)
    const targetDay = ZH_DAY[match[2]]
    const d = new Date(todayDate)
    // Find coming occurrence of targetDay, then add 7 to get "next week"
    let diff = targetDay - d.getDay()
    if (diff <= 0) diff += 7
    d.setDate(d.getDate() + diff)
    // If that occurrence is NOT in the next 7 days from today+1, it's already next week;
    // "下周" always means the week after the current week, so ensure date > this Sunday
    const thisSunday = new Date(todayDate)
    thisSunday.setDate(todayDate.getDate() + (7 - todayDate.getDay()))
    if (d <= thisSunday) d.setDate(d.getDate() + 7)
    dueDate = toLocalDateStr(d)
    title = title.replace(match[0], '').trim()

  } else if (/(这周|本周|这星期|本星期)([一二三四五六日天])/.test(title)) {
    // 这周三 / 本周五 etc. — this week's target day
    const match = title.match(/(这周|本周|这星期|本星期)([一二三四五六日天])/)
    dueDate = toLocalDateStr(nextWeekday(ZH_DAY[match[2]]))
    title = title.replace(match[0], '').trim()

  } else if (/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(title)) {
    const match = title.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)
    dueDate = toLocalDateStr(nextWeekday(EN_DAY[match[1].toLowerCase()]))
    title = title.replace(match[0], '').trim()

  } else {
    // in N days
    const inDaysMatch = title.match(/in\s+(\d+)\s+days?/i)
    if (inDaysMatch) {
      const d = new Date(todayDate)
      d.setDate(d.getDate() + parseInt(inDaysMatch[1]))
      dueDate = toLocalDateStr(d)
      title = title.replace(inDaysMatch[0], '').trim()
    } else {
      const todayStr = toLocalDateStr(todayDate)
      if (/today|今天/i.test(title)) {
        dueDate = todayStr
        title = title.replace(/today|今天/i, '').trim()
      }
    }
  }

  // Clean up extra spaces
  title = title.replace(/\s+/g, ' ').trim()

  return { title, priority, tags, dueDate, dueTime, recurrence, durationMinutes }
}

// Local date string (YYYY-MM-DD) using system timezone — avoids UTC shift
export function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 判断一个任务是否应该在指定日期显示。
 * 处理 daily / weekdays / weekly / monthly / yearly 重复规则。
 *
 * 规则：
 *  - 无重复：dueDate === dateStr（或无 dueDate 且未完成时由调用方处理）
 *  - 有重复：
 *      · 今天已通过 lastCompletedDate 完成 → 不显示（已完成组另行处理）
 *      · 永久完成（status==='completed' 且无 lastCompletedDate）→ 不显示
 *      · dateStr < 起始日期（dueDate 或 createdAt）→ 不显示
 *      · 否则按重复规则判断
 */
export function shouldShowOnDate(task, dateStr) {
  if (!task.recurrence) {
    // 非重复任务：只看 dueDate
    return task.dueDate === dateStr
  }

  // 永久完成（非当天完成的情况）
  if (task.status === 'completed' && task.lastCompletedDate !== dateStr) return false

  // 今天已完成（lastCompletedDate === dateStr 时不显示为"待办"，由已完成组处理）
  if (task.lastCompletedDate === dateStr) return false

  // 起始日期：优先用 dueDate，否则用 createdAt 日期
  const startDate = task.dueDate || task.createdAt?.split('T')[0]
  if (startDate && dateStr < startDate) return false

  const date = new Date(dateStr + 'T00:00:00')
  const dow = date.getDay() // 0=Sun … 6=Sat

  switch (task.recurrence) {
    case 'daily':
      return true

    case 'weekdays': {
      // 周末直接排除
      if (dow === 0 || dow === 6) return false
      // 排除中国法定假日（但保留调休补班）
      // 动态 import 会有问题，改用内联判断（与 chineseHolidays.js 数据同步）
      return !CN_HOLIDAYS_SET.has(dateStr) || CN_WORKDAYS_SET.has(dateStr)
    }

    case 'weekly': {
      const start = new Date((startDate || dateStr) + 'T00:00:00')
      return dow === start.getDay()
    }

    case 'monthly': {
      const start = new Date((startDate || dateStr) + 'T00:00:00')
      return date.getDate() === start.getDate()
    }

    case 'yearly': {
      const start = new Date((startDate || dateStr) + 'T00:00:00')
      return date.getMonth() === start.getMonth() && date.getDate() === start.getDate()
    }

    default:
      return task.dueDate === dateStr
  }
}

// 与 chineseHolidays.js 保持同步的内联集合（避免循环依赖）
const CN_HOLIDAYS_SET = new Set([
  '2025-01-01',
  '2025-01-28','2025-01-29','2025-01-30','2025-01-31',
  '2025-02-01','2025-02-02','2025-02-03','2025-02-04',
  '2025-04-04','2025-04-05','2025-04-06',
  '2025-05-01','2025-05-02','2025-05-03','2025-05-04','2025-05-05',
  '2025-05-31','2025-06-01','2025-06-02',
  '2025-10-01','2025-10-02','2025-10-03','2025-10-04',
  '2025-10-05','2025-10-06','2025-10-07','2025-10-08',
  '2026-01-01','2026-01-02','2026-01-03',
  '2026-02-17','2026-02-18','2026-02-19','2026-02-20',
  '2026-02-21','2026-02-22','2026-02-23','2026-02-24',
  '2026-04-05','2026-04-06','2026-04-07',
  '2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05',
  '2026-06-20','2026-06-21','2026-06-22',
  '2026-09-25','2026-09-26','2026-09-27',
  '2026-10-01','2026-10-02','2026-10-03','2026-10-04',
  '2026-10-05','2026-10-06','2026-10-07',
])
const CN_WORKDAYS_SET = new Set([
  '2025-01-26','2025-02-08','2025-04-27','2025-05-10','2025-09-28','2025-10-11',
  '2026-01-04','2026-02-15','2026-02-28','2026-04-26','2026-05-09','2026-10-10',
])

// Date helpers
export function isOverdue(task) {
  if (!task.dueDate) return false
  if (task.status === 'completed') return false
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(task.dueDate + 'T00:00:00')
  if (dueDay < today) return true
  if (dueDay.getTime() === today.getTime() && task.dueTime) {
    const [h, m] = task.dueTime.split(':').map(Number)
    const dueDateTime = new Date(dueDay)
    dueDateTime.setHours(h, m, 0, 0)
    return dueDateTime < now
  }
  return false
}

export function isToday(dateStr) {
  if (!dateStr) return false
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return dateStr === todayStr
}

export function isTomorrow(dateStr) {
  if (!dateStr) return false
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  return dateStr === tomorrowStr
}

export function formatDueDisplay(task) {
  if (!task.dueDate && !task.dueTime) return ''
  if (!task.dueDate && task.dueTime) return `今天 ${task.dueTime}`
  const timePart = task.dueTime ? ` ${task.dueTime}` : ''
  const durationPart = task.durationMinutes ? ` · ${formatDurationMinutes(task.durationMinutes)}` : ''
  if (isToday(task.dueDate)) return `今天${timePart}${durationPart}`
  if (isTomorrow(task.dueDate)) return `明天${timePart}${durationPart}`
  const d = new Date(task.dueDate + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日${timePart}${durationPart}`
}

export function formatDurationMinutes(minutes) {
  if (!minutes) return ''
  if (minutes % 60 === 0) return `${minutes / 60} 小时`
  if (minutes > 60 && minutes % 30 === 0) return `${minutes / 60} 小时`
  return `${minutes} 分钟`
}

export function formatRelativeTime(isoStr) {
  if (!isoStr) return ''
  const now = new Date()
  const past = new Date(isoStr)
  const diffMs = now - past
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 30) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay === 1) return '昨天'
  if (diffDay < 7) return `${diffDay}天前`
  return past.toLocaleDateString('zh-CN')
}

export function priorityColor(p) {
  switch (p) {
    case 'P1': return 'text-red-500'
    case 'P2': return 'text-orange-500'
    case 'P3': return 'text-amber-400'
    case 'P4': return 'text-stone-400'
    default: return 'text-stone-400'
  }
}

export function priorityBg(p) {
  switch (p) {
    case 'P1': return 'bg-red-500/10 text-red-500'
    case 'P2': return 'bg-orange-500/10 text-orange-500'
    case 'P3': return 'bg-amber-500/10 text-amber-400'
    case 'P4': return 'bg-stone-700 text-stone-400'
    default: return 'bg-stone-700 text-stone-400'
  }
}

export function priorityDot(p) {
  switch (p) {
    case 'P1': return '🔴'
    case 'P2': return '🟠'
    case 'P3': return '🔵'
    case 'P4': return '⚪'
    default: return '⚪'
  }
}

export function priorityKarma(p) {
  switch (p) {
    case 'P1': return 40
    case 'P2': return 30
    case 'P3': return 20
    case 'P4': return 10
    default: return 10
  }
}

export function levelFromKarma(karma) {
  if (karma < 200) return { label: '新手', current: karma, next: 200, nextLabel: '学徒' }
  if (karma < 500) return { label: '学徒', current: karma, next: 500, nextLabel: '熟练' }
  if (karma < 1000) return { label: '进阶', current: karma, next: 1000, nextLabel: '专家' }
  if (karma < 2000) return { label: '专家', current: karma, next: 2000, nextLabel: '大师' }
  return { label: '大师', current: karma, next: karma, nextLabel: '大师' }
}
