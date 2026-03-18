import React, { useState } from 'react'
import { Target, ChevronDown, ChevronRight, X, Trophy } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import TaskCard from '../components/TaskCard.jsx'
import QuickFilters, { applyFilters } from '../components/QuickFilters.jsx'
import { isTomorrow, shouldShowOnDate, toLocalDateStr } from '../utils/helpers.js'

export default function TodayView() {
  const { state, dispatch } = useApp()
  const { todos, focus, filters } = state
  const [showCompleted, setShowCompleted] = useState(true)
  const [showOtherTasks, setShowOtherTasks] = useState(false)

  const todayDate = new Date()
  const todayStr = toLocalDateStr(todayDate)
  const dateLabel = todayDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

  const tomorrowDate = new Date(todayDate); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = toLocalDateStr(tomorrowDate)

  // 今天应显示的任务：
  //   · 有重复规则 → shouldShowOnDate 判断，或今天已完成（lastCompletedDate===today）
  //   · 无重复     → dueDate===today，或无 dueDate 且未完成
  const todayTodos = todos.filter(t => {
    if (t.recurrence) {
      return shouldShowOnDate(t, todayStr) || t.lastCompletedDate === todayStr
    }
    return t.dueDate === todayStr || (!t.dueDate && t.status !== 'completed')
  })

  const tomorrowTodos = todos.filter(t => {
    if (t.recurrence) return shouldShowOnDate(t, tomorrowStr)
    return isTomorrow(t.dueDate)
  })

  const filtered = applyFilters(todayTodos, filters.active, filters.search)
  // 重复任务今天打勾 → 归入已完成；非重复任务看 status
  const completedTasks = filtered.filter(t =>
    t.recurrence ? t.lastCompletedDate === todayStr : t.status === 'completed'
  )
  const pendingTasks = filtered.filter(t =>
    t.recurrence ? t.lastCompletedDate !== todayStr : t.status !== 'completed'
  )

  const sortedPending = [...pendingTasks].sort((a, b) => {
    const p = { P1: 0, P2: 1, P3: 2, P4: 3 }
    if (p[a.priority] !== p[b.priority]) return p[a.priority] - p[b.priority]
    if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime)
    if (a.dueTime) return -1
    if (b.dueTime) return 1
    return 0
  })

  // Focus mode
  const focusTasks = focus.selectedIds.map(id => todos.find(t => t.id === id)).filter(Boolean)
  const otherTasks = sortedPending.filter(t => !focus.selectedIds.includes(t.id))
  const focusCompleted = focus.completedFocusIds.length
  const focusTotal = focus.selectedIds.length
  const focusProgress = focusTotal > 0 ? (focusCompleted / focusTotal) * 100 : 0

  if (focus.active) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        {/* Focus header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target size={20} className="text-orange-400" />
              <h1 className="text-xl font-bold text-stone-100">焦点模式</h1>
            </div>
            <p className="text-sm text-stone-400">{dateLabel}</p>
          </div>
          <button
            onClick={() => dispatch({ type: 'DEACTIVATE_FOCUS' })}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-800 border border-stone-700 transition-colors"
          >
            <X size={14} />
            退出焦点
          </button>
        </div>

        {/* Progress */}
        <div className="mb-6 p-4 bg-stone-900 border border-stone-800 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-stone-300">今日焦点完成</span>
            <span className="text-sm font-bold text-orange-400">{focusCompleted} / {focusTotal}</span>
          </div>
          <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-purple-500 rounded-full progress-bar"
              style={{ width: `${focusProgress}%` }}
            />
          </div>
        </div>

        {/* Focus tasks */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
              🎯 焦点任务 ({focusTotal})
            </h2>
          </div>
          <div className="space-y-2">
            {focusTasks.map(task => (
              <div key={task.id} className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500 rounded-full" />
                <div className="pl-3">
                  <TaskCard task={task} isFocused />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Other tasks (collapsible) */}
        {otherTasks.length > 0 && (
          <div>
            <button
              onClick={() => setShowOtherTasks(!showOtherTasks)}
              className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 hover:text-stone-400 transition-colors"
            >
              {showOtherTasks ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              其他任务 ({otherTasks.length})
            </button>
            {showOtherTasks && (
              <div className="space-y-2 opacity-50">
                {otherTasks.map(task => <TaskCard key={task.id} task={task} />)}
              </div>
            )}
          </div>
        )}

        {focusCompleted === 0 && (
          <div className="mt-8 text-center">
            <p className="text-stone-600 text-sm">💡 完成所有焦点任务后会有惊喜！</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-stone-100">今天</h1>
          <p className="text-sm text-stone-500 mt-0.5">{dateLabel}</p>
        </div>
        <button
          onClick={() => dispatch({ type: 'OPEN_FOCUS_SELECTION' })}
          className="flex items-center gap-2 text-sm font-medium text-orange-400 hover:text-orange-300 border border-orange-500/40 hover:border-orange-500/80 px-3 py-1.5 rounded-xl transition-all hover:bg-orange-500/5"
        >
          <Target size={15} />
          设置焦点
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <QuickFilters todos={todayTodos} />
      </div>

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 hover:text-stone-400 transition-colors w-full text-left"
          >
            {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            ✅ 已完成 ({completedTasks.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 animate-fadeIn">
              {completedTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </div>
      )}

      {/* Pending tasks */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">
          <span>📌 今天待办 ({sortedPending.length})</span>
        </div>
        {sortedPending.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-stone-400 font-medium">今天的任务全部完成了！</p>
            <p className="text-stone-600 text-sm mt-1">享受你的休息时间吧</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPending.map(task => <TaskCard key={task.id} task={task} />)}
          </div>
        )}
      </div>

      {/* Tomorrow preview */}
      {tomorrowTodos.filter(t => t.status !== 'completed').length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
            📅 明天 ({tomorrowTodos.filter(t => t.status !== 'completed').length})
          </h2>
          <div className="space-y-2 opacity-60">
            {tomorrowTodos.filter(t => t.status !== 'completed').slice(0, 3).map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
