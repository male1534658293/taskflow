import React, { useState } from 'react'
import { MessageCircle, RefreshCw, Play, Pause, Check, CalendarX } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { isGoogleConnected } from '../utils/googleCalendar.js'
import {
  priorityDot,
  priorityBg,
  formatDueDisplay,
  isOverdue,
} from '../utils/helpers.js'

export default function TaskCard({ task, compact = false, showFocusCheckbox = false, isFocused = false, onToggleFocus }) {
  const { dispatch } = useApp()
  const [hovered, setHovered] = useState(false)

  const overdue = isOverdue(task)
  const isCompleted = task.status === 'completed'
  const isDoing = task.status === 'doing'

  const dueDisplay = formatDueDisplay(task)
  const subtaskDone = task.subtasks?.filter(s => s.done).length || 0
  const subtaskTotal = task.subtasks?.length || 0
  const commentCount = task.comments?.length || 0

  function handleComplete(e) {
    e.stopPropagation()
    dispatch({ type: 'COMPLETE_TODO', payload: task.id })
  }

  function handleStartDoing(e) {
    e.stopPropagation()
    if (isDoing) {
      dispatch({ type: 'UPDATE_TODO', payload: { id: task.id, status: 'todo' } })
    } else {
      dispatch({ type: 'START_DOING', payload: task.id })
    }
  }

  function handleCardClick() {
    dispatch({ type: 'OPEN_TASK_DETAIL', payload: task })
  }

  function handleFocusToggle(e) {
    e.stopPropagation()
    if (onToggleFocus) onToggleFocus(task.id)
  }

  return (
    <div
      className={`task-card relative flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer group
        ${isCompleted ? 'opacity-60' : ''}
        ${isFocused ? 'border-orange-500/50 bg-orange-500/5' : 'border-stone-800 bg-stone-900 hover:bg-stone-800/60'}
        ${compact ? 'py-2' : ''}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCardClick}
    >
      {/* Focus mode checkbox */}
      {showFocusCheckbox && (
        <div
          className="flex-shrink-0 mt-0.5 cursor-pointer"
          onClick={handleFocusToggle}
        >
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            isFocused ? 'bg-orange-600 border-orange-600' : 'border-stone-600 hover:border-orange-400'
          }`}>
            {isFocused && <Check size={10} className="text-white" />}
          </div>
        </div>
      )}

      {/* Checkbox */}
      {!showFocusCheckbox && (
        <button
          className="flex-shrink-0 mt-0.5"
          onClick={handleComplete}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
            isCompleted
              ? 'bg-green-500 border-green-500'
              : 'border-stone-600 hover:border-orange-400'
          }`}>
            {isCompleted && <Check size={10} className="text-white" />}
          </div>
        </button>
      )}

      {/* Priority dot */}
      <span className="flex-shrink-0 text-sm leading-5 mt-0.5">
        {priorityDot(task.priority)}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className={`text-sm font-medium flex-1 ${isCompleted ? 'line-through text-stone-500' : 'text-stone-100'}`}>
            {task.title}
          </span>
          {/* Status badge */}
          {isDoing && (
            <span className="flex-shrink-0 text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">
              进行中
            </span>
          )}
        </div>

        {/* Meta row */}
        {!compact && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Due time */}
            {dueDisplay && (
              <span className={`text-xs ${overdue ? 'text-red-400' : 'text-stone-500'}`}>
                {overdue ? '⚠️ ' : ''}{dueDisplay}
              </span>
            )}

            {/* Tags */}
            {task.tags?.map(tag => (
              <span key={tag} className="text-xs bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}

            {/* Recurrence */}
            {task.recurrence && (
              <RefreshCw size={11} className="text-stone-500" />
            )}

            {/* Subtasks */}
            {subtaskTotal > 0 && (
              <span className="text-xs text-stone-500">
                {subtaskDone}/{subtaskTotal}
              </span>
            )}

            {/* Comments */}
            {commentCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-stone-500">
                <MessageCircle size={11} />
                {commentCount}
              </span>
            )}

            {/* Google Calendar unsync marker */}
            {isGoogleConnected() && !task.gcalEventId && (
              <button
                onClick={e => { e.stopPropagation(); dispatch({ type: 'RESYNC_TODO_GCAL', payload: task.id }) }}
                className="flex items-center gap-0.5 text-xs text-stone-600 hover:text-orange-400 transition-colors"
                title="未同步到 Google 日历，点击同步"
              >
                <CalendarX size={11} />
                <span>未同步</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right side: priority badge */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityBg(task.priority)}`}>
          {task.priority}
        </span>
      </div>

      {/* Hover actions */}
      {hovered && !isCompleted && !showFocusCheckbox && (
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-stone-800 rounded-lg px-1.5 py-1 shadow-lg border border-stone-700 animate-fadeIn"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={handleStartDoing}
            className="flex items-center gap-1 text-xs text-stone-300 hover:text-orange-400 px-1.5 py-0.5 rounded hover:bg-stone-700 transition-colors"
          >
            {isDoing ? <Pause size={11} /> : <Play size={11} />}
            {isDoing ? '暂停' : '开始'}
          </button>
          <button
            onClick={handleComplete}
            className="flex items-center gap-1 text-xs text-stone-300 hover:text-green-400 px-1.5 py-0.5 rounded hover:bg-stone-700 transition-colors"
          >
            <Check size={11} />
            完成
          </button>
        </div>
      )}
    </div>
  )
}
