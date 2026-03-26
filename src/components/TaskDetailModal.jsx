import React, { useState, useEffect, useRef } from 'react'
import { X, Trash2, Edit3, RefreshCw, Bell, User, Tag, Calendar, MessageCircle, ChevronRight, Check, Send, Play, Pause, RotateCcw, Timer } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { priorityBg, priorityColor, priorityDot, formatDueDisplay, formatRelativeTime, TASK_DURATION_OPTIONS, formatDurationMinutes } from '../utils/helpers.js'

export default function TaskDetailModal({ task }) {
  const { state, dispatch } = useApp()
  const [newComment, setNewComment] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState(null)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newTagInput, setNewTagInput] = useState('')

  // Pomodoro state
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroPhase, setPomodoroPhase] = useState('work')
  const pomodoroRef = useRef(null)

  // Always use latest task data from store
  const liveTask = state.todos.find(t => t.id === task.id) || task

  const subtaskDone = liveTask.subtasks?.filter(s => s.done).length || 0
  const subtaskTotal = liveTask.subtasks?.length || 0

  // Pomodoro timer tick
  useEffect(() => {
    if (pomodoroRunning) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTime(prev => {
          if (prev <= 1) {
            clearInterval(pomodoroRef.current)
            if (pomodoroPhase === 'work') {
              dispatch({ type: 'COMPLETE_POMODORO', payload: liveTask.id })
              setPomodoroPhase('break')
              setPomodoroRunning(true)
              return 5 * 60
            } else {
              setPomodoroPhase('work')
              setPomodoroRunning(false)
              return 25 * 60
            }
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(pomodoroRef.current)
    }
    return () => clearInterval(pomodoroRef.current)
  }, [pomodoroRunning, pomodoroPhase])

  function handleComplete() {
    dispatch({ type: 'COMPLETE_TODO', payload: liveTask.id })
  }

  function handleDelete() {
    dispatch({ type: 'DELETE_TODO', payload: liveTask.id })
  }

  function handleToggleSubtask(subtaskId) {
    dispatch({ type: 'TOGGLE_SUBTASK', payload: { todoId: liveTask.id, subtaskId } })
  }

  function handleSendComment() {
    if (!newComment.trim()) return
    dispatch({ type: 'ADD_COMMENT', payload: { todoId: liveTask.id, comment: newComment.trim() } })
    setNewComment('')
  }

  function handleAddSubtask() {
    if (!newSubtaskTitle.trim()) return
    dispatch({ type: 'ADD_SUBTASK', payload: { todoId: liveTask.id, title: newSubtaskTitle.trim() } })
    setNewSubtaskTitle('')
  }

  function handleEnterEdit() {
    setEditData({
      id: liveTask.id,
      title: liveTask.title,
      priority: liveTask.priority,
      dueDate: liveTask.dueDate || '',
      dueTime: liveTask.dueTime || '',
      durationMinutes: liveTask.durationMinutes || null,
      recurrence: liveTask.recurrence || null,
      tags: [...(liveTask.tags || [])],
      description: liveTask.description || '',
    })
    setEditing(true)
  }

  function handleSaveEdit() {
    dispatch({ type: 'UPDATE_TODO', payload: editData })
    setEditing(false)
  }

  function handleCancelEdit() {
    setEditing(false)
    setEditData(null)
  }

  function handleRemoveTag(tag) {
    setEditData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }

  function handleAddTag(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = newTagInput.trim().replace(/,/g, '')
      if (val && !editData.tags.includes(val)) {
        setEditData(prev => ({ ...prev, tags: [...prev.tags, val] }))
      }
      setNewTagInput('')
    }
  }

  function formatPomodoro(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  function handlePomodoroReset() {
    setPomodoroRunning(false)
    clearInterval(pomodoroRef.current)
    setPomodoroTime(pomodoroPhase === 'work' ? 25 * 60 : 5 * 60)
  }

  const recurrenceLabel = {
    daily: '每天',
    weekly: '每周',
    weekdays: '工作日',
    monthly: '每月',
    yearly: '每年',
  }

  const priorityColors = {
    P1: 'bg-red-500/20 text-red-400 border-red-500/40',
    P2: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    P3: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    P4: 'bg-stone-700 text-stone-400 border-stone-600',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => dispatch({ type: 'CLOSE_TASK_DETAIL' })}
      />
      <div className="relative w-full max-w-lg mx-4 bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl animate-fadeIn max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${priorityBg(liveTask.priority)}`}>
              {priorityDot(liveTask.priority)} {liveTask.priority}
            </span>
            {liveTask.status === 'completed' && (
              <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">已完成</span>
            )}
            {liveTask.status === 'doing' && (
              <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded">进行中</span>
            )}
            {!editing && (
              <button
                onClick={handleEnterEdit}
                className="text-stone-500 hover:text-orange-400 transition-colors p-1 rounded"
                title="编辑任务"
              >
                <Edit3 size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => dispatch({ type: 'CLOSE_TASK_DETAIL' })}
            className="text-stone-500 hover:text-stone-300 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {editing && editData ? (
            /* Edit Mode */
            <div className="px-5 pt-4 pb-4 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs text-stone-500 uppercase tracking-wide mb-1 block">标题</label>
                <textarea
                  value={editData.title}
                  onChange={e => setEditData(prev => ({ ...prev, title: e.target.value }))}
                  rows={2}
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs text-stone-500 uppercase tracking-wide mb-1 block">优先级</label>
                <div className="flex gap-2">
                  {['P1', 'P2', 'P3', 'P4'].map(p => (
                    <button
                      key={p}
                      onClick={() => setEditData(prev => ({ ...prev, priority: p }))}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        editData.priority === p
                          ? priorityColors[p]
                          : 'bg-stone-800 text-stone-500 border-stone-700 hover:border-stone-500'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date and time */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-stone-500 uppercase tracking-wide mb-1 block">截止日期</label>
                  <input
                    type="date"
                    value={editData.dueDate}
                    onChange={e => setEditData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-stone-500 uppercase tracking-wide mb-1 block">截止时间</label>
                  <input
                    type="time"
                    value={editData.dueTime}
                    onChange={e => setEditData(prev => ({ ...prev, dueTime: e.target.value }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-500 uppercase tracking-wide mb-1 block">任务时长</label>
                <div className="flex gap-1.5 flex-wrap">
                  {TASK_DURATION_OPTIONS.map(opt => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setEditData(prev => ({ ...prev, durationMinutes: opt.value }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        editData.durationMinutes === opt.value
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                          : 'bg-stone-800 text-stone-500 border-stone-700 hover:border-stone-500 hover:text-stone-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="text-xs text-stone-500 uppercase tracking-wide mb-1 block">重复频率</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { value: null, label: '不重复' },
                    { value: 'daily', label: '每天' },
                    { value: 'weekdays', label: '工作日' },
                    { value: 'weekly', label: '每周' },
                    { value: 'monthly', label: '每月' },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setEditData(prev => ({ ...prev, recurrence: opt.value }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        editData.recurrence === opt.value
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                          : 'bg-stone-800 text-stone-500 border-stone-700 hover:border-stone-500 hover:text-stone-300'
                      }`}
                    >
                      {opt.value ? '🔁 ' : ''}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs text-stone-500 uppercase tracking-wide mb-1 block">标签</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {editData.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full border border-stone-700">
                      #{tag}
                      <button onClick={() => handleRemoveTag(tag)} className="text-stone-600 hover:text-red-400 transition-colors">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="输入标签后按 Enter 添加..."
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-stone-500 uppercase tracking-wide mb-1 block">描述</label>
                <textarea
                  value={editData.description}
                  onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="添加任务描述..."
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
                />
              </div>

              {/* Save/Cancel */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-2 text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-xl transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 py-2 text-sm text-stone-400 hover:text-stone-200 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            /* Read Mode */
            <>
              <div className="px-5 pt-4 pb-2">
                <h2 className={`text-lg font-semibold leading-snug ${liveTask.status === 'completed' ? 'line-through text-stone-500' : 'text-stone-100'}`}>
                  {liveTask.title}
                </h2>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {liveTask.tags?.map(tag => (
                    <span key={tag} className="text-xs bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full border border-stone-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Description */}
              {liveTask.description && (
                <div className="mx-5 mt-3 p-3 bg-stone-800/50 rounded-xl border border-stone-700">
                  <p className="text-sm text-stone-300 whitespace-pre-wrap leading-relaxed">{liveTask.description}</p>
                </div>
              )}

              {/* Meta fields */}
              <div className="px-5 mt-4 space-y-2">
                {liveTask.dueDate && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={14} className="text-stone-500 flex-shrink-0" />
                    <span className="text-stone-400">截止</span>
                    <span className="text-stone-200">{formatDueDisplay(liveTask)}</span>
                  </div>
                )}
                {liveTask.assignedTo && (
                  <div className="flex items-center gap-3 text-sm">
                    <User size={14} className="text-stone-500 flex-shrink-0" />
                    <span className="text-stone-400">负责人</span>
                    <span className="text-stone-200">{liveTask.assignedTo}</span>
                  </div>
                )}
                {liveTask.recurrence && (
                  <div className="flex items-center gap-3 text-sm">
                    <RefreshCw size={14} className="text-stone-500 flex-shrink-0" />
                    <span className="text-stone-400">重复</span>
                    <span className="text-stone-200">{recurrenceLabel[liveTask.recurrence] || liveTask.recurrence}</span>
                  </div>
                )}
                {liveTask.durationMinutes && (
                  <div className="flex items-center gap-3 text-sm">
                    <Timer size={14} className="text-stone-500 flex-shrink-0" />
                    <span className="text-stone-400">时长</span>
                    <span className="text-stone-200">{formatDurationMinutes(liveTask.durationMinutes)}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-stone-500 text-xs w-3.5">⚡</span>
                  <span className="text-stone-400">Karma</span>
                  <span className={`font-medium ${priorityColor(liveTask.priority)}`}>
                    +{{ P1: 40, P2: 30, P3: 20, P4: 10 }[liveTask.priority] || 10} 分
                  </span>
                </div>
              </div>

              {/* Subtasks - always rendered */}
              <div className="px-5 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                    子任务 ({subtaskDone}/{subtaskTotal})
                  </h4>
                  {subtaskTotal > 0 && (
                    <div className="w-20 bg-stone-800 rounded-full h-1 overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all"
                        style={{ width: `${(subtaskDone / subtaskTotal) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  {liveTask.subtasks?.map(sub => (
                    <div
                      key={sub.id}
                      onClick={() => handleToggleSubtask(sub.id)}
                      className="flex items-center gap-2.5 py-1.5 cursor-pointer group"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        sub.done ? 'bg-green-500 border-green-500' : 'border-stone-600 group-hover:border-orange-400'
                      }`}>
                        {sub.done && <Check size={10} className="text-white" />}
                      </div>
                      <span className={`text-sm ${sub.done ? 'line-through text-stone-500' : 'text-stone-300'}`}>
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Add subtask input */}
                <div className="flex gap-2 mt-2">
                  <input
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="添加子任务..."
                    className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim()}
                    className="px-3 py-2 text-xs font-medium bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
                  >
                    添加
                  </button>
                </div>
              </div>

              {/* Pomodoro Timer */}
              <div className="px-5 mt-4">
                <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Timer size={13} className="text-orange-400" />
                      <h4 className="text-xs font-medium text-orange-400 uppercase tracking-wide">
                        番茄钟 {pomodoroPhase === 'work' ? '专注' : '休息'}
                      </h4>
                    </div>
                    <span className="text-xs text-stone-500">
                      已完成 {liveTask.pomodoroCount || 0} 个
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-mono font-bold text-orange-300">
                      {formatPomodoro(pomodoroTime)}
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        onClick={() => setPomodoroRunning(r => !r)}
                        className="w-8 h-8 flex items-center justify-center bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors"
                      >
                        {pomodoroRunning ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button
                        onClick={handlePomodoroReset}
                        className="w-8 h-8 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-stone-400 rounded-lg transition-colors"
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments */}
              <div className="px-5 mt-4 mb-2">
                <h4 className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">
                  评论 ({liveTask.comments?.length || 0})
                </h4>
                <div className="space-y-2.5">
                  {liveTask.comments?.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-orange-600/40 flex items-center justify-center text-xs font-medium text-orange-300 flex-shrink-0">
                        {c.author?.[0] || '?'}
                      </div>
                      <div className="flex-1 bg-stone-800 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-stone-300">{c.author}</span>
                          <span className="text-xs text-stone-600">{formatRelativeTime(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-stone-300">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* New comment */}
                <div className="flex gap-2 mt-3">
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendComment()}
                    placeholder="添加评论..."
                    className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={!newComment.trim()}
                    className="w-9 h-9 flex items-center justify-center bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors flex-shrink-0"
                  >
                    <Send size={14} className="text-white" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-stone-800 flex-shrink-0">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm text-stone-400 flex-1">确认删除这个任务？</span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
              >
                确认删除
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-500/10"
              >
                <Trash2 size={13} />
                删除
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleComplete}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    liveTask.status === 'completed'
                      ? 'bg-stone-700 text-stone-300 hover:bg-stone-600'
                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  }`}
                >
                  <Check size={13} />
                  {liveTask.status === 'completed' ? '取消完成' : '标记完成'}
                </button>
                <button
                  onClick={() => dispatch({ type: 'CLOSE_TASK_DETAIL' })}
                  className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  关闭
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
