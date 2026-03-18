import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { getDayType, getHolidayName } from '../utils/chineseHolidays.js'
import { shouldShowOnDate } from '../utils/helpers.js'

const PRIORITY_DOT = {
  P1: 'bg-red-500',
  P2: 'bg-orange-500',
  P3: 'bg-amber-400',
  P4: 'bg-stone-400',
}

const PRIORITY_PILL = {
  P1: 'bg-red-500/20 text-red-400',
  P2: 'bg-orange-500/20 text-orange-400',
  P3: 'bg-amber-500/20 text-amber-400',
  P4: 'bg-stone-700 text-stone-400',
}

const DAYS_HEADER = ['日', '一', '二', '三', '四', '五', '六']

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// 图例项
function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-stone-500">
      <span className={`w-2.5 h-2.5 rounded-sm ${color}`} />
      {label}
    </div>
  )
}

export default function CalendarView() {
  const { state, dispatch } = useApp()
  const { todos } = state
  const [viewDate, setViewDate] = useState(new Date())

  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const leadingCount = firstDay.getDay()
  const totalCells = Math.ceil((leadingCount + lastDay.getDate()) / 7) * 7

  const cells = []

  // 上月补位
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = leadingCount - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const pm = month - 1 < 0 ? 11 : month - 1
    const py = month - 1 < 0 ? year - 1 : year
    cells.push({ day: d, dateStr: toDateStr(py, pm, d), outside: true })
  }

  // 本月
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d), outside: false })
  }

  // 下月补位
  const trailingCount = totalCells - cells.length
  for (let d = 1; d <= trailingCount; d++) {
    const nm = month + 1 > 11 ? 0 : month + 1
    const ny = month + 1 > 11 ? year + 1 : year
    cells.push({ day: d, dateStr: toDateStr(ny, nm, d), outside: true })
  }

  // dateStr -> todos（含重复任务的虚拟实例）
  const allDateStrs = cells.filter(c => !c.outside).map(c => c.dateStr)
  const todosByDate = {}
  allDateStrs.forEach(dateStr => {
    todosByDate[dateStr] = todos.filter(t => {
      if (t.recurrence) return shouldShowOnDate(t, dateStr) || t.lastCompletedDate === dateStr
      return t.dueDate === dateStr
    })
  })

  // 本月有几行
  const weeks = totalCells / 7

  return (
    <div className="p-6 min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-stone-100">日历</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-lg font-semibold text-stone-100 min-w-[110px] text-center">
            {year}年 {month + 1}月
          </span>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setViewDate(new Date())}
            className="ml-1 px-3 py-1 text-xs rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 transition-colors"
          >
            今天
          </button>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 mb-3 px-0.5">
        <LegendDot color="bg-red-500/25" label="法定假日" />
        <LegendDot color="bg-stone-700/60" label="周末" />
        <LegendDot color="bg-orange-500/20" label="调休补班" />
        <LegendDot color="bg-stone-900" label="工作日" />
      </div>

      {/* 日历网格 */}
      <div className="rounded-xl border border-stone-800 overflow-hidden">
        {/* 星期头部 */}
        <div className="grid grid-cols-7 border-b border-stone-800">
          {DAYS_HEADER.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-xs font-medium bg-stone-900 ${
                i === 0 || i === 6 ? 'text-red-400/70' : 'text-stone-500'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 日期单元格 */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const isToday = cell.dateStr === todayStr
            const cellTodos = !cell.outside ? (todosByDate[cell.dateStr] || []) : []
            const visible = cellTodos.slice(0, 3)
            const overflow = cellTodos.length - 3
            const colIdx = idx % 7 // 0=Sun, 6=Sat
            const isLastRow = idx >= (weeks - 1) * 7

            // 日历类型（仅对本月格子生效）
            const dayType = !cell.outside ? getDayType(cell.dateStr) : null
            const holidayName = !cell.outside ? getHolidayName(cell.dateStr) : null

            // 背景色
            let bg = 'bg-stone-950' // outside
            if (!cell.outside) {
              if (dayType === 'holiday') bg = 'bg-red-950/40'
              else if (dayType === 'weekend') bg = 'bg-stone-800/40'
              else if (dayType === 'workday') bg = 'bg-orange-950/30'
              else bg = 'bg-stone-900'
            }

            // 日期数字颜色
            let numColor = 'text-stone-600' // outside
            if (!cell.outside) {
              if (dayType === 'holiday') numColor = 'text-red-400'
              else if (dayType === 'weekend') numColor = 'text-red-300/70'
              else if (dayType === 'workday') numColor = 'text-stone-300'
              else numColor = 'text-stone-300'
            }

            return (
              <div
                key={idx}
                className={`${weeks > 5 ? 'min-h-[80px]' : 'min-h-[96px]'} p-1.5 border-stone-800
                  ${colIdx < 6 ? 'border-r' : ''}
                  ${!isLastRow ? 'border-b' : ''}
                  ${bg}
                  transition-colors
                `}
              >
                {/* 顶部行：日期数字 + 角标 */}
                <div className="flex items-start justify-between mb-1 gap-1">
                  {/* 节日名 / 调休标签 */}
                  <div className="flex-1 min-w-0">
                    {holidayName && (
                      <span className="inline-block text-[10px] font-medium text-red-400 bg-red-500/15 px-1 py-0.5 rounded leading-none truncate max-w-full">
                        {holidayName}
                      </span>
                    )}
                    {!holidayName && dayType === 'workday' && (
                      <span className="inline-block text-[10px] font-medium text-orange-400 bg-orange-500/15 px-1 py-0.5 rounded leading-none">
                        班
                      </span>
                    )}
                  </div>

                  {/* 日期圆圈 */}
                  <span
                    className={`text-xs font-medium w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-orange-600 text-white font-bold'
                        : numColor
                    }`}
                  >
                    {cell.day}
                  </span>
                </div>

                {/* 任务条 */}
                <div className="space-y-0.5">
                  {visible.map(todo => (
                    <button
                      key={todo.id}
                      onClick={() => dispatch({ type: 'OPEN_TASK_DETAIL', payload: todo })}
                      className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-left text-[11px] font-medium transition-opacity hover:opacity-80 ${
                        PRIORITY_PILL[todo.priority] || PRIORITY_PILL.P4
                      } ${todo.status === 'completed' ? 'opacity-40 line-through' : ''}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[todo.priority] || PRIORITY_DOT.P4}`} />
                      <span className="truncate">{todo.title}</span>
                    </button>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[10px] text-stone-500 pl-1">+{overflow} 更多</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
