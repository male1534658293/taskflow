import React, { useState } from 'react'
import { Tag, ChevronDown, ChevronRight, Circle } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import TaskCard from '../components/TaskCard.jsx'

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4',
  '#14b8a6', '#a855f7', '#f43f5e', '#84cc16',
]

export default function TagsView() {
  const { state, dispatch } = useApp()
  const { todos } = state
  const [collapsed, setCollapsed] = useState({})

  const active = todos.filter(t => t.status !== 'completed')

  // Collect all tags
  const allTags = [...new Set(active.flatMap(t => t.tags || []))].sort()
  const untagged = active.filter(t => !t.tags || t.tags.length === 0)

  function toggle(key) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function openTask(task) {
    dispatch({ type: 'OPEN_TASK_DETAIL', payload: task })
  }

  function renderSection(label, items, colorIdx, key) {
    if (!items.length) return null
    const color = TAG_COLORS[colorIdx % TAG_COLORS.length]
    const isCollapsed = collapsed[key]
    return (
      <div key={key} className="mb-3">
        <button
          onClick={() => toggle(key)}
          className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-stone-800/60 transition-colors group"
        >
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-sm font-semibold text-stone-200 flex-1 text-left">
            {label === '__untagged' ? '未分组' : `#${label}`}
          </span>
          <span className="text-xs text-stone-500 bg-stone-800 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
          {isCollapsed
            ? <ChevronRight size={14} className="text-stone-600 group-hover:text-stone-400" />
            : <ChevronDown size={14} className="text-stone-600 group-hover:text-stone-400" />
          }
        </button>

        {!isCollapsed && (
          <div className="mt-1 space-y-1 pl-5">
            {items.map(task => (
              <TaskCard key={task.id} task={task} onClick={() => openTask(task)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-orange-600/20 border border-orange-500/30 rounded-xl flex items-center justify-center">
          <Tag size={18} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-100">标签汇总</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            共 {allTags.length} 个标签 · {active.length} 个待办
          </p>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-stone-600">
          <Tag size={40} className="mb-4 opacity-30" />
          <p className="text-sm">暂无待办任务</p>
        </div>
      ) : (
        <div>
          {allTags.map((tag, i) => {
            const items = active.filter(t => (t.tags || []).includes(tag))
            return renderSection(tag, items, i, `tag_${tag}`)
          })}
          {renderSection('__untagged', untagged, allTags.length, 'untagged')}
        </div>
      )}
    </div>
  )
}
