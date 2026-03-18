import React, { useState } from 'react'
import { Search, X, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import TaskCard from '../components/TaskCard.jsx'
import QuickFilters, { applyFilters } from '../components/QuickFilters.jsx'
import { isToday, isTomorrow } from '../utils/helpers.js'

export default function InboxView() {
  const { state, dispatch } = useApp()
  const { todos, filters } = state
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [sort, setSort] = useState('priority')

  const allIncomplete = todos.filter(t => t.status !== 'completed')
  const filtered = applyFilters(allIncomplete, filters.active, filters.search)

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (sort === 'priority') {
        const p = { P1: 0, P2: 1, P3: 2, P4: 3 }
        return (p[a.priority] || 3) - (p[b.priority] || 3)
      }
      if (sort === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      }
      if (sort === 'created') {
        return new Date(b.createdAt) - new Date(a.createdAt)
      }
      return 0
    })
  }

  function groupTasks(tasks) {
    const groups = {
      today: { label: '今天', tasks: [] },
      tomorrow: { label: '明天', tasks: [] },
      week: { label: '本周', tasks: [] },
      later: { label: '以后', tasks: [] },
      nodate: { label: '无日期', tasks: [] },
    }

    for (const task of tasks) {
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

    return Object.entries(groups)
      .filter(([, g]) => g.tasks.length > 0)
      .map(([id, g]) => ({ id, ...g, tasks: sortTasks(g.tasks) }))
  }

  const groups = groupTasks(filtered)

  function toggleGroup(id) {
    setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-stone-100">收件箱</h1>
          <p className="text-sm text-stone-500 mt-0.5">全部任务 ({allIncomplete.length})</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="bg-stone-800 border border-stone-700 text-stone-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-500"
          >
            <option value="priority">按优先级</option>
            <option value="dueDate">按截止时间</option>
            <option value="created">按创建时间</option>
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
        <input
          value={filters.search}
          onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
          placeholder="搜索任务..."
          className="w-full bg-stone-900 border border-stone-700 text-stone-100 text-sm pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-orange-500 placeholder-stone-600 transition-colors"
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

      {/* Filters */}
      <div className="mb-5">
        <QuickFilters todos={allIncomplete} />
      </div>

      {/* Task groups */}
      {groups.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">✨</div>
          <p className="text-stone-400 font-medium">没有找到匹配的任务</p>
          <p className="text-stone-600 text-sm mt-1">尝试调整过滤条件</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(group => (
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
          ))}
        </div>
      )}
    </div>
  )
}
