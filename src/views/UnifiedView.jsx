import React, { useState } from 'react'
import { Calendar, Layout, List, Plus, ChevronDown, ChevronRight, Search, X, Trash2, Filter } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import TaskCard from '../components/TaskCard.jsx'
import QuickFilters, { applyFilters } from '../components/QuickFilters.jsx'
import { isToday, isTomorrow, toLocalDateStr, getKnownTags, shouldShowOnDate } from '../utils/helpers.js'

const KANBAN_COLUMNS = [
  { id: 'todo', label: '待办', color: 'text-stone-400', dot: '⚪' },
  { id: 'doing', label: '进行中', color: 'text-orange-400', dot: '🟡' },
  { id: 'completed', label: '已完成', color: 'text-green-400', dot: '✅' },
]

const TIME_GROUPS = [
  { id: 'today', label: '今天' },
  { id: 'inbox', label: '收件箱' },
]

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#14b8a6', '#a855f7', '#f43f5e', '#84cc16',
]

export default function UnifiedView() {
  const { state, dispatch } = useApp()
  const { todos, filters, selectedTag } = state

  // 视图模式
  const [viewMode, setViewMode] = useState('list') // 'list' | 'kanban'
  const [timeGroup, setTimeGroup] = useState('today') // 'today' | 'inbox'

  // 删除标签弹窗
  const [tagToDelete, setTagToDelete] = useState(null)

  // 看板拖拽
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  // 列表折叠
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [showCompleted, setShowCompleted] = useState(true)

  const todayDate = new Date()
  const todayStr = toLocalDateStr(todayDate)

  // 所有未完成任务
  const allIncomplete = todos.filter(t => t.status !== 'completed')

  // 标签数据
  const allTags = getKnownTags(todos)
  const activeTasks = selectedTag
    ? allIncomplete.filter(t => (t.tags || []).includes(selectedTag))
    : allIncomplete

  // 根据时间分组获取任务
  function getTimeGroupedTasks() {
    if (timeGroup === 'today') {
      const todayTodos = activeTasks.filter(t => {
        if (t.recurrence) {
          return shouldShowOnDate(t, todayStr) || t.lastCompletedDate === todayStr
        }
        return t.dueDate === todayStr || (!t.dueDate && t.status !== 'completed')
      })
      const filtered = applyFilters(todayTodos, filters.active, filters.search)
      const completed = filtered.filter(t =>
        t.recurrence ? t.lastCompletedDate === todayStr : t.status === 'completed'
      )
      const pending = filtered.filter(t =>
        t.recurrence ? t.lastCompletedDate !== todayStr : t.status !== 'completed'
      )
      return { pending, completed, total: filtered.length }
    } else {
      const filtered = applyFilters(activeTasks, filters.active, filters.search)
      const groups = {
        today: { label: '今天', tasks: [] },
        tomorrow: { label: '明天', tasks: [] },
        week: { label: '本周', tasks: [] },
        later: { label: '以后', tasks: [] },
        nodate: { label: '无日期', tasks: [] },
      }

      for (const task of filtered) {
        if (!task.dueDate) {
          groups.nodate.tasks.push(task)
        } else if (isToday(task.dueDate)) {
          groups.today.tasks.push(task)
        } else if (isTomorrow(task.dueDate)) {
          groups.tomorrow.tasks.push(task)
        } else {
          const now = new Date()
          const d = new Date(task.dueDate)
          const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24))
          if (diffDays <= 7) {
            groups.week.tasks.push(task)
          } else {
            groups.later.tasks.push(task)
          }
        }
      }

      return {
        grouped: Object.entries(groups)
          .filter(([, g]) => g.tasks.length > 0)
          .map(([id, g]) => ({ id, ...g })),
        total: filtered.length,
      }
    }
  }

  const taskData = getTimeGroupedTasks()

  // 看板任务
  function getKanbanTasks(status) {
    const baseTasks = timeGroup === 'today'
      ? todos.filter(t => {
          if (t.recurrence) return shouldShowOnDate(t, todayStr) || t.lastCompletedDate === todayStr
          return t.dueDate === todayStr || (!t.dueDate)
        })
      : activeTasks

    const filtered = selectedTag
      ? baseTasks.filter(t => (t.tags || []).includes(selectedTag))
      : baseTasks

    return applyFilters(filtered, filters.active, filters.search)
      .filter(t => t.status === status)
      .sort((a, b) => {
        const p = { P1: 0, P2: 1, P3: 2, P4: 3 }
        return (p[a.priority] || 3) - (p[b.priority] || 3)
      })
  }

  function toggleGroup(id) {
    setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleDeleteTag(tag, e) {
    e.stopPropagation()
    setTagToDelete(tag)
  }

  function confirmDeleteTag() {
    dispatch({ type: 'DELETE_TAG', payload: tagToDelete })
    setTagToDelete(null)
  }

  // 看板拖拽处理
  function handleDragStart(e, taskId) {
    setDraggingId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, columnId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  function handleDrop(e, columnId) {
    e.preventDefault()
    if (!draggingId) return
    const task = todos.find(t => t.id === draggingId)
    if (!task) return

    if (columnId === 'completed') {
      dispatch({ type: 'COMPLETE_TODO', payload: draggingId })
    } else {
      dispatch({ type: 'UPDATE_TODO', payload: { id: draggingId, status: columnId } })
    }

    setDraggingId(null)
    setDragOverColumn(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-100">任务管理</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            共 {allIncomplete.length} 个待办任务
            {selectedTag && <span className="text-orange-400 ml-2">· #{selectedTag}</span>}
          </p>
        </div>
      </div>

      {/* 标签筛选 */}
      {allTags.length > 0 && (
        <div className="mb-4">
              <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => dispatch({ type: 'SET_SELECTED_TAG', payload: null })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                selectedTag === null
                  ? 'bg-orange-600 text-white'
                  : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <Filter size={14} />
              全部
            </button>
            {allTags.map((tag, i) => (
              <div key={tag} className="relative">
                <button
                  onClick={() => dispatch({ type: 'SET_SELECTED_TAG', payload: tag })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 group ${
                    selectedTag === tag
                      ? 'bg-orange-600 text-white'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: TAG_COLORS[i % TAG_COLORS.length] }} />
                  #{tag}
                  <button
                    onClick={(e) => handleDeleteTag(tag, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 视图控制栏 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1 bg-stone-900 border border-stone-700 rounded-xl p-1">
          {TIME_GROUPS.map(group => (
            <button
              key={group.id}
              onClick={() => setTimeGroup(group.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                timeGroup === group.id
                  ? 'bg-orange-600 text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {group.id === 'today' ? <Calendar size={14} className="inline mr-1" /> : <List size={14} className="inline mr-1" />}
              {group.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-stone-900 border border-stone-700 rounded-xl p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-orange-600 text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'kanban'
                ? 'bg-orange-600 text-white'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Layout size={16} />
          </button>
        </div>

        <div className="flex-1" />

        {/* 搜索和筛选 */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            value={filters.search}
            onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
            placeholder="搜索任务..."
            className="w-full bg-stone-900 border border-stone-700 text-stone-100 text-sm pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:border-orange-500 placeholder-stone-600 transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => dispatch({ type: 'SET_SEARCH', payload: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <QuickFilters todos={allIncomplete} />

        {/* 新建任务按钮 */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_NLP_INPUT' })}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={16} />
          新建任务
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'list' ? (
          <div className="max-w-2xl mx-auto">
            {timeGroup === 'today' ? (
              <>
                {/* 今天视图 - 待办任务 */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">
                    <span>📌 待办 ({taskData.pending?.length || 0})</span>
                  </div>
                  {taskData.pending?.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-3">🎉</div>
                      <p className="text-stone-400 font-medium">今天的任务全部完成了！</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {taskData.pending?.map(task => <TaskCard key={task.id} task={task} />)}
                    </div>
                  )}
                </div>

                {/* 已完成 */}
                {taskData.completed?.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 hover:text-stone-400 transition-colors w-full text-left"
                    >
                      {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      ✅ 已完成 ({taskData.completed.length})
                    </button>
                    {showCompleted && (
                      <div className="space-y-2 animate-fadeIn">
                        {taskData.completed.map(task => <TaskCard key={task.id} task={task} />)}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* 收件箱视图 - 分组 */
              <div className="space-y-5">
                {taskData.grouped?.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-4xl mb-3">✨</div>
                    <p className="text-stone-400 font-medium">没有找到匹配的任务</p>
                  </div>
                ) : (
                  taskData.grouped?.map(group => (
                    <div key={group.id}>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 hover:text-stone-300 transition-colors w-full text-left"
                      >
                        {collapsedGroups[group.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        {group.label} ({group.tasks.length})
                      </button>
                      {!collapsedGroups[group.id] && (
                        <div className="space-y-2 animate-fadeIn">
                          {group.tasks.map(task => <TaskCard key={task.id} task={task} />)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          /* 看板视图 */
          <div className="grid grid-cols-3 gap-4 h-[calc(100vh-320px)]">
            {KANBAN_COLUMNS.map(col => {
              const tasks = getKanbanTasks(col.id)
              const isDragOver = dragOverColumn === col.id
              return (
                <div
                  key={col.id}
                  onDragOver={e => handleDragOver(e, col.id)}
                  onDrop={e => handleDrop(e, col.id)}
                  onDragLeave={() => setDragOverColumn(null)}
                  className={`flex flex-col rounded-2xl border transition-all ${
                    isDragOver
                      ? 'border-orange-500/60 bg-orange-500/5'
                      : 'border-stone-800 bg-stone-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{col.dot}</span>
                      <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                      <span className="text-xs bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded-full font-medium">
                        {tasks.length}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {tasks.length === 0 ? (
                      <div className={`flex flex-col items-center justify-center h-24 rounded-xl border border-dashed transition-colors ${
                        isDragOver ? 'border-orange-500/50 bg-orange-500/5' : 'border-stone-800'
                      }`}>
                        <p className="text-xs text-stone-600">
                          {isDragOver ? '放到这里' : '暂无任务'}
                        </p>
                      </div>
                    ) : (
                      tasks.map(task => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={e => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          className={`transition-opacity ${draggingId === task.id ? 'opacity-40' : ''}`}
                        >
                          <TaskCard task={task} compact />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 删除标签确认弹窗 */}
      {tagToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setTagToDelete(null)}
          />
          <div className="relative w-full max-w-md mx-4 bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl animate-fadeIn">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                  <Trash2 size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-100">删除标签</h3>
                  <p className="text-sm text-stone-500">确定要删除这个标签吗？</p>
                </div>
              </div>
              <div className="mb-5 p-3 bg-stone-800/50 rounded-xl">
                <span className="text-sm text-stone-300">将从所有任务中移除标签：</span>
                <span className="ml-2 px-2 py-1 bg-stone-700 text-stone-300 rounded-full text-sm font-medium">
                  #{tagToDelete}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTagToDelete(null)}
                  className="flex-1 py-2 text-sm text-stone-400 hover:text-stone-200 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteTag}
                  className="flex-1 py-2 text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-xl transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
