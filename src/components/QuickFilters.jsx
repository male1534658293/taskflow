import React from 'react'
import { X } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { isOverdue, isToday } from '../utils/helpers.js'

const FILTERS = [
  { id: '高优先级', label: '🔴 高优先级' },
  { id: '逾期', label: '⚠️ 逾期' },
  { id: '我的', label: '📌 我的' },
  { id: '本周', label: '🟠 本周' },
  { id: '有评论', label: '💬 有评论' },
  { id: '循环', label: '🔁 循环' },
]

export function applyFilters(todos, filters, search) {
  let result = todos

  if (search) {
    const q = search.toLowerCase()
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    )
  }

  for (const f of filters) {
    switch (f) {
      case '高优先级':
        result = result.filter(t => t.priority === 'P1' || t.priority === 'P2')
        break
      case '逾期':
        result = result.filter(t => isOverdue(t))
        break
      case '我的':
        result = result.filter(t => t.assignedTo === 'Luke')
        break
      case '本周': {
        const now = new Date()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 7)
        result = result.filter(t => {
          if (!t.dueDate) return false
          const d = new Date(t.dueDate)
          return d >= startOfWeek && d < endOfWeek
        })
        break
      }
      case '有评论':
        result = result.filter(t => t.comments?.length > 0)
        break
      case '循环':
        result = result.filter(t => t.recurrence)
        break
    }
  }

  return result
}

export default function QuickFilters({ todos }) {
  const { state, dispatch } = useApp()
  const { filters } = state

  const overdueCount = todos?.filter(t => isOverdue(t) && t.status !== 'completed').length || 0
  const commentCount = todos?.filter(t => t.comments?.length > 0).length || 0

  const getBadge = (id) => {
    if (id === '逾期') return overdueCount
    if (id === '有评论') return commentCount
    return null
  }

  const hasActiveFilters = filters.active.length > 0

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {FILTERS.map(f => {
        const isActive = filters.active.includes(f.id)
        const badge = getBadge(f.id)
        return (
          <button
            key={f.id}
            onClick={() => dispatch({ type: 'TOGGLE_FILTER', payload: f.id })}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-all ${
              isActive
                ? 'bg-orange-600 border-orange-600 text-white'
                : 'bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300'
            }`}
          >
            {f.label}
            {badge != null && badge > 0 && (
              <span className={`text-xs font-medium px-1 rounded-full ${
                isActive ? 'bg-white/20' : 'bg-stone-700 text-stone-300'
              }`}>
                {badge}
              </span>
            )}
          </button>
        )
      })}

      {hasActiveFilters && (
        <button
          onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}
          className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-300 px-2 py-1.5 rounded-full hover:bg-stone-800 transition-colors"
        >
          <X size={12} />
          清除
        </button>
      )}
    </div>
  )
}
