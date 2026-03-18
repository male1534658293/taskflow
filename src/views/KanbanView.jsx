import React, { useState } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import TaskCard from '../components/TaskCard.jsx'
import { priorityBg, priorityDot } from '../utils/helpers.js'

const COLUMNS = [
  { id: 'todo', label: '待办', color: 'text-stone-400', dot: '⚪' },
  { id: 'doing', label: '进行中', color: 'text-orange-400', dot: '🟡' },
  { id: 'completed', label: '已完成', color: 'text-green-400', dot: '✅' },
]

export default function KanbanView() {
  const { state, dispatch } = useApp()
  const { todos } = state
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

  function getColumnTasks(status) {
    return todos
      .filter(t => t.status === status)
      .sort((a, b) => {
        const p = { P1: 0, P2: 1, P3: 2, P4: 3 }
        return (p[a.priority] || 3) - (p[b.priority] || 3)
      })
  }

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
    <div className="p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-100">看板</h1>
          <p className="text-sm text-stone-500 mt-0.5">拖动任务卡片以更改状态</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 h-[calc(100vh-140px)]">
        {COLUMNS.map(col => {
          const tasks = getColumnTasks(col.id)
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
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">{col.dot}</span>
                  <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                  <span className="text-xs bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded-full font-medium">
                    {tasks.length}
                  </span>
                </div>
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_NLP_INPUT' })}
                  className="text-stone-600 hover:text-orange-400 transition-colors p-0.5 rounded"
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Tasks */}
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
    </div>
  )
}
