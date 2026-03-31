import React, { useState } from 'react'
import { Target, ChevronDown, ChevronRight, X, AlertCircle, Lightbulb, BookOpen, Trash2, CheckCircle2, Clock, Zap, Sparkles } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import TaskCard from '../components/TaskCard.jsx'
import QuickFilters, { applyFilters } from '../components/QuickFilters.jsx'
import { isTomorrow, shouldShowOnDate, toLocalDateStr } from '../utils/helpers.js'
import { isDueToday } from '../utils/srs.js'

export default function TodayView() {
  const { state, dispatch } = useApp()
  const { todos, focus, filters, learning } = state
  const [showCompleted, setShowCompleted] = useState(false)
  const [showOtherTasks, setShowOtherTasks] = useState(false)
  const [showSuggested, setShowSuggested] = useState(true)

  const todayDate = new Date()
  const todayStr = toLocalDateStr(todayDate)
  const dateLabel = todayDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

  const tomorrowDate = new Date(todayDate); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = toLocalDateStr(tomorrowDate)

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

  const overdueTasks = todos.filter(t =>
    !t.recurrence && t.dueDate && t.dueDate < todayStr && t.status !== 'completed'
  )

  const todayIds = new Set(todayTodos.map(t => t.id))
  const overdueIds = new Set(overdueTasks.map(t => t.id))
  const suggestedTasks = todos.filter(t =>
    !todayIds.has(t.id) &&
    !overdueIds.has(t.id) &&
    t.status !== 'completed' &&
    (t.priority === 'P1' || t.priority === 'P2') &&
    !t.recurrence
  ).slice(0, 3)

  const dueReviews = learning.cards.filter(isDueToday).length

  const focusTasks = focus.selectedIds.map(id => todos.find(t => t.id === id)).filter(Boolean)
  const otherTasks = sortedPending.filter(t => !focus.selectedIds.includes(t.id))
  const focusCompleted = focus.completedFocusIds.length
  const focusTotal = focus.selectedIds.length
  const focusProgress = focusTotal > 0 ? (focusCompleted / focusTotal) * 100 : 0

  const dailyProgress = filtered.length > 0 ? (completedTasks.length / filtered.length) * 100 : 0
  const hasP1Tasks = sortedPending.some(t => t.priority === 'P1')
  const hasOverdueTasks = overdueTasks.length > 0

  if (focus.active) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
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

        <div className="mb-6 p-4 bg-gradient-to-r from-orange-950/40 to-purple-950/40 border border-orange-500/30 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-stone-200">
              {focusCompleted === focusTotal ? '🎉 全部完成！' : '今日焦点进度'}
            </span>
            <span className="text-sm font-bold text-orange-400">{focusCompleted} / {focusTotal}</span>
          </div>
          <div className="h-3 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-purple-500 rounded-full progress-bar"
              style={{ width: `${focusProgress}%` }}
            />
          </div>
          {focusCompleted > 0 && (
            <p className="text-xs text-stone-400 mt-2">
              ✅ 已完成 {focusCompleted} 个焦点任务，继续加油！
            </p>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide flex items-center gap-2">
              <Zap size={14} className="text-orange-400" />
              焦点任务 ({focusTotal})
            </h2>
          </div>
          <div className="space-y-2">
            {focusTasks.map((task, index) => (
              <div key={task.id} className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-purple-500 rounded-full" />
                <div className="pl-4">
                  <TaskCard task={task} isFocused />
                </div>
              </div>
            ))}
          </div>
        </div>

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

        {focusCompleted === focusTotal && focusTotal > 0 && (
          <div className="mt-8 text-center p-6 bg-gradient-to-r from-orange-900/30 to-purple-900/30 rounded-2xl border border-orange-500/30">
            <div className="text-4xl mb-3">🎊</div>
            <p className="text-stone-200 font-medium">太棒了！所有焦点任务都完成了！</p>
            <p className="text-stone-500 text-sm mt-2">你可以退出焦点模式，或者继续完成其他任务</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-stone-100">今天</h1>
          <p className="text-sm text-stone-500 mt-0.5">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {sortedPending.filter(t => t.dueDate === todayStr).length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('将今天所有待办任务延期到明天？')) {
                  dispatch({ type: 'CLEAR_TODAY' })
                }
              }}
              className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-red-400 border border-stone-700 hover:border-red-500/40 px-3 py-1.5 rounded-xl transition-all"
              title="把今天未完成任务迁移到明天"
            >
              <Trash2 size={14} />
              迁移到明天
            </button>
          )}
          <button
            onClick={() => dispatch({ type: 'OPEN_FOCUS_SELECTION' })}
            className="flex items-center gap-2 text-sm font-medium text-orange-400 hover:text-orange-300 border border-orange-500/40 hover:border-orange-500/80 px-3 py-1.5 rounded-xl transition-all hover:bg-orange-500/5"
          >
            <Target size={15} />
            设置焦点
          </button>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="mb-5 p-4 bg-stone-900/50 border border-stone-700 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-stone-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-400" />
              今日进度
            </span>
            <span className="text-sm font-bold text-green-400">
              {completedTasks.length} / {filtered.length}
              <span className="text-stone-500 font-normal ml-1">
                ({Math.round(dailyProgress)}%)
              </span>
            </span>
          </div>
          <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full progress-bar"
              style={{ width: `${dailyProgress}%` }}
            />
          </div>
          {hasP1Tasks && (
            <p className="text-xs text-orange-400 mt-2 flex items-center gap-1">
              <Zap size={12} /> 有高优先级任务待处理
            </p>
          )}
        </div>
      )}

      <div className="mb-4">
        <QuickFilters todos={todayTodos} />
      </div>

      {dueReviews > 0 && (
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'learning' })}
          className="w-full flex items-center gap-3 mb-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded-xl hover:bg-purple-900/30 transition-colors text-left"
        >
          <BookOpen size={15} className="text-purple-400 flex-shrink-0" />
          <span className="text-sm text-purple-300">
            📖 今日有 <span className="font-semibold">{dueReviews}</span> 张知识卡片待复习
          </span>
          <span className="ml-auto text-xs text-purple-500">去复习 →</span>
        </button>
      )}

      {hasOverdueTasks && (
        <div className="mb-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">
            <AlertCircle size={13} />
            逾期任务 ({overdueTasks.length}) - 请优先处理
          </div>
          <div className="space-y-2">
            {overdueTasks.map(task => (
              <div key={task.id} className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-full" />
                <div className="pl-4">
                  <TaskCard task={task} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">
          {hasP1Tasks ? (
            <Zap size={14} className="text-orange-400" />
          ) : (
            <Clock size={14} />
          )}
          <span>今天待办 ({sortedPending.length})</span>
        </div>
        {sortedPending.length === 0 ? (
          <div className="text-center py-12 bg-stone-900/30 rounded-2xl border border-stone-700/50">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-stone-300 font-medium">今天的任务全部完成了！</p>
            <p className="text-stone-500 text-sm mt-1">享受你的休息时间吧</p>
            {completedTasks.length > 0 && (
              <p className="text-xs text-green-400 mt-3">
                ✅ 今日完成了 {completedTasks.length} 个任务
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPending.map(task => (
              <div key={task.id} className={task.priority === 'P1' ? 'animate-pulse-slow' : ''}>
                <TaskCard task={task} />
              </div>
            ))}
          </div>
        )}
      </div>

      {suggestedTasks.length > 0 && (
        <div className="mb-5">
          <button
            onClick={() => setShowSuggested(v => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-yellow-500 uppercase tracking-wide mb-2 hover:text-yellow-400 transition-colors w-full text-left"
          >
            <Lightbulb size={13} />
            建议今日完成 ({suggestedTasks.length})
            {showSuggested ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {showSuggested && (
            <div className="space-y-2">
              {suggestedTasks.map(task => (
                <div key={task.id} className="relative opacity-80 hover:opacity-100 transition-opacity">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-yellow-500/50 rounded-full" />
                  <div className="pl-3">
                    <TaskCard task={task} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 hover:text-stone-400 transition-colors w-full text-left"
          >
            {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <CheckCircle2 size={13} className="text-green-400" />
            已完成 ({completedTasks.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 animate-fadeIn">
              {completedTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </div>
      )}

      {tomorrowTodos.filter(t => t.status !== 'completed').length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Sparkles size={13} />
            明天预览 ({tomorrowTodos.filter(t => t.status !== 'completed').length})
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
