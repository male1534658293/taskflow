import React from 'react'
import { X, Target, Check } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { isToday, priorityDot, formatDueDisplay } from '../utils/helpers.js'

export default function FocusSelectionModal() {
  const { state, dispatch } = useApp()
  const { todos, focus } = state

  const todayTasks = todos.filter(
    t => t.status !== 'completed' && (isToday(t.dueDate) || !t.dueDate)
  )

  const selectedIds = focus.selectedIds
  const selectedCount = selectedIds.length
  const canActivate = selectedCount >= 3

  function handleToggle(id) {
    dispatch({ type: 'TOGGLE_FOCUS_TASK', payload: id })
  }

  function handleActivate() {
    if (canActivate) {
      dispatch({ type: 'ACTIVATE_FOCUS' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => dispatch({ type: 'CLOSE_FOCUS_SELECTION' })}
      />
      <div className="relative w-full max-w-md mx-4 bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl animate-fadeIn max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-orange-400" />
            <h3 className="font-semibold text-stone-100">设置今日焦点</h3>
          </div>
          <button
            onClick={() => dispatch({ type: 'CLOSE_FOCUS_SELECTION' })}
            className="text-stone-500 hover:text-stone-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-stone-800 flex-shrink-0">
          <p className="text-sm text-stone-400">选择 3-7 个今天最重要的任务</p>
          <p className={`text-xs mt-0.5 font-medium ${canActivate ? 'text-green-400' : 'text-orange-400'}`}>
            当前已选: {selectedCount} 个{!canActivate ? `（最少 3 个）` : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {todayTasks.length === 0 ? (
            <p className="text-center text-stone-500 py-8 text-sm">今天没有待办任务</p>
          ) : (
            todayTasks.map(task => {
              const isSelected = selectedIds.includes(task.id)
              const isMaxed = selectedIds.length >= 7 && !isSelected
              return (
                <div
                  key={task.id}
                  onClick={() => !isMaxed && handleToggle(task.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                    isMaxed ? 'opacity-40 cursor-not-allowed' : ''
                  } ${
                    isSelected
                      ? 'bg-orange-600/10 border-orange-500/50'
                      : 'bg-stone-800/50 border-stone-700 hover:border-stone-600'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? 'bg-orange-600 border-orange-600' : 'border-stone-600'
                  }`}>
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                  <span className="text-sm flex-shrink-0">{priorityDot(task.priority)}</span>
                  <span className={`text-sm flex-1 ${isSelected ? 'text-stone-100 font-medium' : 'text-stone-300'}`}>
                    {task.title}
                  </span>
                  {task.dueTime && (
                    <span className="text-xs text-stone-500 flex-shrink-0">⏰ {task.dueTime}</span>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="px-5 py-4 border-t border-stone-800 flex-shrink-0 space-y-3">
          <p className="text-xs text-stone-600 text-center">
            💡 建议根据截止时间和优先级选择，心理研究表明 3-5 个最佳
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => dispatch({ type: 'CLOSE_FOCUS_SELECTION' })}
              className="flex-1 px-4 py-2 text-sm text-stone-400 hover:text-stone-200 rounded-xl hover:bg-stone-800 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleActivate}
              disabled={!canActivate}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                canActivate
                  ? 'bg-orange-600 hover:bg-orange-500 text-white'
                  : 'bg-stone-800 text-stone-600 cursor-not-allowed'
              }`}
            >
              🎯 设为焦点 ({selectedCount}/7)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
