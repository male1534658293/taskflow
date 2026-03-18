// 中国农历计算工具
// 数据来源：天文历法推算，覆盖 2018-2031

const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']

const DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

// 农历年数据
// start: 正月初一（公历），leap: 闰月序号（0=无闰，N=在第N个正月后插入闰N月）
// months: 每月天数（闰年13项，平年12项；闰月天数插在第 leap 项，0-indexed）
const LUNAR_YEARS = [
  { start: '2018-02-16', leap: 0, months: [29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 30] },
  { start: '2019-02-05', leap: 0, months: [30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 29] },
  { start: '2020-01-25', leap: 4, months: [30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29] },
  { start: '2021-02-12', leap: 0, months: [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29] },
  { start: '2022-02-01', leap: 0, months: [30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30] },
  { start: '2023-01-22', leap: 2, months: [29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29] },
  { start: '2024-02-10', leap: 0, months: [29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 29, 30] },
  { start: '2025-01-29', leap: 6, months: [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30] },
  { start: '2026-02-17', leap: 0, months: [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29] },
  { start: '2027-02-06', leap: 0, months: [30, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 29] },
  { start: '2028-01-26', leap: 5, months: [30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29] },
  { start: '2029-02-13', leap: 0, months: [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30] },
  { start: '2030-02-03', leap: 0, months: [30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 29] },
  { start: '2031-01-23', leap: 3, months: [30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29] },
]

function daysBetween(dateStr1, dateStr2) {
  const [y1, m1, d1] = dateStr1.split('-').map(Number)
  const [y2, m2, d2] = dateStr2.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

/**
 * 获取公历日期对应的农历信息
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {{ month: number, day: number, isLeap: boolean } | null}
 */
export function getLunarDate(dateStr) {
  let yearData = null

  for (let i = 0; i < LUNAR_YEARS.length - 1; i++) {
    const d = daysBetween(LUNAR_YEARS[i].start, dateStr)
    const totalDays = LUNAR_YEARS[i].months.reduce((a, b) => a + b, 0)
    if (d >= 0 && d < totalDays) {
      yearData = LUNAR_YEARS[i]
      break
    }
  }
  // 最后一年：只要日期不早于起始日即可
  if (!yearData) {
    const last = LUNAR_YEARS[LUNAR_YEARS.length - 1]
    if (daysBetween(last.start, dateStr) >= 0) yearData = last
  }

  if (!yearData) return null

  let remaining = daysBetween(yearData.start, dateStr)
  let monthIndex = 0
  while (monthIndex < yearData.months.length - 1 && remaining >= yearData.months[monthIndex]) {
    remaining -= yearData.months[monthIndex]
    monthIndex++
  }

  const day = remaining + 1 // 1-based
  const { leap } = yearData
  let regularMonth, isLeap

  if (leap === 0) {
    regularMonth = monthIndex + 1
    isLeap = false
  } else if (monthIndex < leap) {
    regularMonth = monthIndex + 1
    isLeap = false
  } else if (monthIndex === leap) {
    regularMonth = leap
    isLeap = true
  } else {
    regularMonth = monthIndex
    isLeap = false
  }

  return { month: regularMonth, day, isLeap }
}

/**
 * 格式化农历日期为显示文字
 * @param {{ month: number, day: number, isLeap: boolean }} lunarDate
 * @returns {string}
 */
export function formatLunar(lunarDate) {
  if (!lunarDate) return ''
  if (lunarDate.day === 1) {
    const prefix = lunarDate.isLeap ? '闰' : ''
    return prefix + MONTH_NAMES[lunarDate.month - 1] + '月'
  }
  return DAY_NAMES[lunarDate.day - 1]
}
