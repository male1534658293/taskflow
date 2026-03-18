import React, { useState } from 'react'
import { Check, Trash2, Flag, X } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'

const PRIORITIES = ['P1', 'P2', 'P3', 'P4']

const PRIORITY_COLORS = {
  P1: 'text-red-400 hover:bg-red-500/20',
  P2: 'text-orange-400 hover:bg-orange-500/20',
  P3: 'text-yellow-400 hover:bg-yellow-500/20',
  P4: 'text-stone-400 hover:bg-stone-700',
}

export default function BulkActionBar({ selectedIds, onClearSelection }) {
  const { dispatch } = useApp()
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)

  if (selectedIds.length === 0) return null

  function handleComplete() {
    dispatch({ type: 'BULK_COMPLETE', payload: selectedIds })
    onClearSelection()
  }

  function handleSetPriority(priority) {
    dispatch({ type: 'BULK_SET_PRIORITY', payload: { ids: selectedIds, priority } })
    setShowPriorityMenu(false)
    onClearSelection()
  }

  function handleDelete() {
    if (window.confirm(`确认删除选中的 ${selectedIds.length} 个任务？`)) {
      dispatch({ type: 'BULK_DELETE', payload: selectedIds })
      onClearSelection()
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="bg-stone-800 border border-stone-700 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
        {/* Count label */}
        <span className="text-sm text-stone-300 font-medium whitespace-nowrap">
          已选 <span className="text-white font-bold">{selectedIds.length}</span> 个
        </span>

        <div className="w-px h-5 bg-stone-700" />

        {/* Complete button */}
        <button
          onClick={handleComplete}
          title="全部完成"
          className="flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors"
        >
          <Check size={15} />
          <span>完成</span>
        </button>

        {/* Priority dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPriorityMenu(v => !v)}
            title="设置优先级"
            className="flex items-center gap-1.5 text-sm text-stone-300 hover:text-stone-100 px-3 py-1.5 rounded-lg hover:bg-stone-700 transition-colors"
          >
            <Flag size={15} />
            <span>优先级</span>
          </button>
          {showPriorityMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-stone-800 border border-stone-700 rounded-xl shadow-xl overflow-hidden">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => handleSetPriority(p)}
                  className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${PRIORITY_COLORS[p]}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          title="删除所选"
          className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
        >
          <Trash2 size={15} />
          <span>删除</span>
        </button>

        <div className="w-px h-5 bg-stone-700" />

        {/* Clear selection */}
        <button
          onClick={onClearSelection}
          title="取消选择"
          className="text-stone-500 hover:text-stone-300 p-1.5 rounded-lg hover:bg-stone-700 transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
