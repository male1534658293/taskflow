import React from 'react'
import { useApp } from '../store/AppContext.jsx'
import { priorityDot } from '../utils/helpers.js'

const PRIORITY_LABELS = { P1: 'P1 紧急', P2: 'P2 高', P3: 'P3 中', P4: 'P4 低' }

const PRIORITY_BAR = {
  P1: 'bg-red-500',
  P2: 'bg-orange-500',
  P3: 'bg-amber-400',
  P4: 'bg-stone-500',
}

const PRIORITY_SECTION_BORDER = {
  P1: 'border-red-500/30',
  P2: 'border-orange-500/30',
  P3: 'border-amber-500/30',
  P4: 'border-stone-700',
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const TOTAL_DAYS = 30
const DAYS_BEFORE = 15

export default function GanttView() {
  const { state, dispatch } = useApp()
  const { todos } = state

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(today)
  startDate.setDate(today.getDate() - DAYS_BEFORE)

  // Build header days array
  const headerDays = []
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    headerDays.push({ date: d, dateStr: toDateStr(d), dayNum: d.getDate() })
  }

  const todayStr = toDateStr(today)
  const todayOffset = DAYS_BEFORE // index of today in the 30-day window

  // Filter tasks with dueDate
  const tasksWithDue = todos.filter(t => t.dueDate)

  if (tasksWithDue.length === 0) {
    return (
      <div className="p-6 min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center gap-4">
        <div className="text-stone-600 text-6xl">📅</div>
        <div className="text-stone-400 text-lg font-medium">没有设置截止日期的任务</div>
        <div className="text-stone-600 text-sm">为任务设置截止日期后，它们将显示在甘特图中</div>
      </div>
    )
  }

  // Group by priority
  const priorityGroups = { P1: [], P2: [], P3: [], P4: [] }
  tasksWithDue.forEach(t => {
    const p = t.priority || 'P4'
    if (priorityGroups[p]) priorityGroups[p].push(t)
  })

  // Calculate bar offset for a task
  function getBarOffset(dueDate) {
    const due = new Date(dueDate + 'T00:00:00')
    due.setHours(0, 0, 0, 0)
    const diffMs = due - startDate
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    return diffDays
  }

  const TITLE_COL_WIDTH = 200 // px
  const DAY_WIDTH = 28 // px per day
  const TIMELINE_WIDTH = TOTAL_DAYS * DAY_WIDTH

  return (
    <div className="p-6 min-h-screen bg-stone-950 text-stone-100">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-100">甘特图</h1>
        <p className="text-sm text-stone-500 mt-1">
          显示前后 15 天的任务截止日期分布
        </p>
      </div>

      <div className="rounded-xl border border-stone-800 overflow-hidden bg-stone-900">
        {/* Timeline header */}
        <div className="flex border-b border-stone-800" style={{ minWidth: TITLE_COL_WIDTH + TIMELINE_WIDTH }}>
          {/* Title column header */}
          <div
            className="flex-shrink-0 px-4 py-2 text-xs font-medium text-stone-500 border-r border-stone-800 bg-stone-900"
            style={{ width: TITLE_COL_WIDTH }}
          >
            任务
          </div>
          {/* Day headers */}
          <div className="relative flex bg-stone-900" style={{ width: TIMELINE_WIDTH }}>
            {headerDays.map((hd, i) => {
              const isToday = hd.dateStr === todayStr
              const isFirstOfMonth = hd.dayNum === 1
              return (
                <div
                  key={i}
                  className={`flex-shrink-0 flex items-center justify-center text-[10px] font-medium border-r border-stone-800 py-2 ${
                    isToday
                      ? 'bg-indigo-950 text-orange-400'
                      : isFirstOfMonth
                      ? 'text-stone-300'
                      : 'text-stone-600'
                  }`}
                  style={{ width: DAY_WIDTH }}
                >
                  {isFirstOfMonth ? `${hd.date.getMonth() + 1}/${hd.dayNum}` : hd.dayNum}
                </div>
              )
            })}
          </div>
        </div>

        {/* Priority sections */}
        {['P1', 'P2', 'P3', 'P4'].map(priority => {
          const tasks = priorityGroups[priority]
          if (tasks.length === 0) return null

          return (
            <div key={priority} className={`border-b ${PRIORITY_SECTION_BORDER[priority]} last:border-b-0`}>
              {/* Section label */}
              <div
                className="flex items-center gap-2 px-4 py-1.5 bg-stone-950/50 border-b border-stone-800"
                style={{ minWidth: TITLE_COL_WIDTH + TIMELINE_WIDTH }}
              >
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  {PRIORITY_LABELS[priority]}
                </span>
              </div>

              {/* Task rows */}
              {tasks.map(task => {
                const offset = getBarOffset(task.dueDate)
                const inRange = offset >= 0 && offset < TOTAL_DAYS
                const leftPct = (offset / TOTAL_DAYS) * 100
                const isCompleted = task.status === 'completed'

                return (
                  <div
                    key={task.id}
                    className="flex items-center border-b border-stone-800 last:border-b-0 hover:bg-stone-800/30 transition-colors group"
                    style={{ minWidth: TITLE_COL_WIDTH + TIMELINE_WIDTH, height: 36 }}
                  >
                    {/* Task title */}
                    <div
                      className="flex-shrink-0 flex items-center gap-2 px-3 border-r border-stone-800 h-full"
                      style={{ width: TITLE_COL_WIDTH }}
                    >
                      <span className="text-sm flex-shrink-0">{priorityDot(priority)}</span>
                      <button
                        onClick={() => dispatch({ type: 'OPEN_TASK_DETAIL', payload: task })}
                        className={`text-xs truncate text-left hover:text-orange-400 transition-colors ${
                          isCompleted ? 'line-through text-stone-600' : 'text-stone-300'
                        }`}
                        style={{ maxWidth: TITLE_COL_WIDTH - 56 }}
                        title={task.title}
                      >
                        {task.title}
                      </button>
                    </div>

                    {/* Timeline bar area */}
                    <div
                      className="relative h-full flex-shrink-0"
                      style={{ width: TIMELINE_WIDTH }}
                    >
                      {/* Today vertical line */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-500/40 z-10 pointer-events-none"
                        style={{ left: (todayOffset + 0.5) * DAY_WIDTH }}
                      />

                      {/* Task bar */}
                      {inRange && (
                        <button
                          onClick={() => dispatch({ type: 'OPEN_TASK_DETAIL', payload: task })}
                          className={`absolute top-1/2 -translate-y-1/2 h-4 rounded-sm z-20 transition-opacity hover:opacity-80 ${
                            PRIORITY_BAR[priority]
                          } ${isCompleted ? 'opacity-40' : 'opacity-90'}`}
                          style={{
                            left: offset * DAY_WIDTH + 2,
                            width: DAY_WIDTH - 4,
                          }}
                          title={task.title}
                        />
                      )}

                      {/* Out-of-range indicator */}
                      {!inRange && (
                        <div className="absolute top-1/2 -translate-y-1/2 text-[10px] text-stone-600 px-2">
                          {offset < 0 ? '← 过去' : '未来 →'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-stone-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-500/60" />
          <span>今天</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500 opacity-90" />
          <span>P1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-orange-500 opacity-90" />
          <span>P2</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-400 opacity-90" />
          <span>P3</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-stone-500 opacity-90" />
          <span>P4</span>
        </div>
      </div>
    </div>
  )
}
