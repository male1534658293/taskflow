import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Minus, Plus, Check, Zap, ChevronDown, ChevronUp,
  Pin, PinOff, Timer, Play, Pause, RotateCcw, Edit3, Calendar
} from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { isToday, isOverdue, parseNLP } from '../utils/helpers.js'

// ─── Constants ────────────────────────────────────────────────
const SIZES = {
  mini:     { w: 200, h: 300,  label: '迷你' },
  compact:  { w: 320, h: 450,  label: '紧凑' },
  standard: { w: 400, h: 600,  label: '标准' },
  expanded: { w: 500, h: 800,  label: '展开' },
}

const PC = {
  P1: { bar: 'bg-red-500',    dot: 'bg-red-400',    text: 'text-red-400' },
  P2: { bar: 'bg-orange-500', dot: 'bg-orange-400', text: 'text-orange-400' },
  P3: { bar: 'bg-amber-500',  dot: 'bg-amber-400',  text: 'text-amber-400' },
  P4: { bar: 'bg-stone-600',  dot: 'bg-stone-500',  text: 'text-stone-500' },
}

const FILTERS = [
  { id: 'today',   label: '今天' },
  { id: 'all',     label: '全部' },
  { id: 'p1',      label: 'P1' },
  { id: 'overdue', label: '逾期' },
  { id: 'week',    label: '本周' },
  { id: 'done',    label: '完成' },
]

const ITEM_H = 44
const POMO_WORK = 25 * 60
const POMO_BREAK = 5 * 60

// ─── Helpers ──────────────────────────────────────────────────
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmt(s) {
  return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
}

function beep(freq = 880) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    osc.frequency.value = freq; osc.type = 'sine'
    g.gain.setValueAtTime(0.4, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start(); osc.stop(ctx.currentTime + 0.6)
  } catch {}
}

// ─── CircleProgress ───────────────────────────────────────────
function Ring({ r, progress, color, size }) {
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#292524" strokeWidth="2.5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  )
}

// ─── VirtualList ──────────────────────────────────────────────
function VirtualList({ items, renderItem, empty }) {
  const ref = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [h, setH] = useState(300)

  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(e => setH(e[0].contentRect.height))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  if (items.length === 0) {
    return (
      <div ref={ref} className="flex-1 flex flex-col items-center justify-center text-stone-700 text-xs"
        style={{ WebkitAppRegion: 'no-drag' }}>
        {empty}
      </div>
    )
  }

  if (items.length < 30) {
    return (
      <div ref={ref} className="flex-1 overflow-y-auto" style={{ WebkitAppRegion: 'no-drag' }}>
        {items.map((it, i) => renderItem(it, i))}
      </div>
    )
  }

  const totalH = items.length * ITEM_H
  const start = Math.max(0, Math.floor(scrollTop / ITEM_H) - 3)
  const end   = Math.min(items.length - 1, Math.ceil((scrollTop + h) / ITEM_H) + 3)

  return (
    <div ref={ref} className="flex-1 overflow-y-auto" style={{ WebkitAppRegion: 'no-drag' }}
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{ height: totalH, position: 'relative' }}>
        <div style={{ position: 'absolute', top: start * ITEM_H, width: '100%' }}>
          {items.slice(start, end + 1).map((it, i) => renderItem(it, start + i))}
        </div>
      </div>
    </div>
  )
}

// ─── TaskCard ─────────────────────────────────────────────────
function TaskCard({ todo, focused, onComplete, onDelete, onEdit, editing, editData, onChange, onSave, onCancel }) {
  const [hovered, setHovered] = useState(false)
  const isDone = todo.status === 'completed'
  const isLate = isOverdue(todo)
  const c = PC[todo.priority] || PC.P4

  return (
    <div>
      <div
        className={`relative flex items-center gap-1.5 px-2 transition-colors
          ${isDone ? 'opacity-40' : ''}
          ${focused ? 'bg-orange-500/10' : hovered ? 'bg-stone-800/50' : ''}`}
        style={{ height: ITEM_H, WebkitAppRegion: 'no-drag' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Priority bar */}
        <div className={`w-1 self-stretch rounded-full flex-shrink-0 my-2.5 ${c.bar}`} />

        {/* Checkbox */}
        <button onClick={() => onComplete(todo.id)}
          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
            ${isDone ? 'bg-green-500 border-green-500' : 'border-stone-600 hover:border-orange-400'}`}>
          {isDone && <Check size={8} className="text-white" />}
        </button>

        {/* Title + meta */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
          <span className={`text-xs truncate flex-1 ${isDone ? 'line-through text-stone-500' : 'text-stone-200'}`}>
            {todo.title}
          </span>
          {!hovered && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {isLate && !isDone && <span className="text-red-400 text-xs font-bold">!</span>}
              {todo.dueTime && !isDone && (
                <span className={`text-xs ${isLate ? 'text-red-400' : 'text-stone-600'}`}>{todo.dueTime}</span>
              )}
              {todo.tags?.length > 0 && <span className="text-xs text-stone-700">#{todo.tags.length}</span>}
              {todo.comments?.length > 0 && <span className="text-xs text-stone-700">💬{todo.comments.length}</span>}
            </div>
          )}
        </div>

        {/* Hover actions */}
        {hovered && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {!isDone && (
              <button onClick={() => onEdit(todo)}
                className="w-6 h-6 rounded flex items-center justify-center text-stone-500 hover:text-orange-400 hover:bg-orange-500/10 transition-colors">
                <Edit3 size={10} />
              </button>
            )}
            <button onClick={() => onComplete(todo.id)}
              className="w-6 h-6 rounded flex items-center justify-center text-stone-500 hover:text-green-400 hover:bg-green-500/10 transition-colors">
              <Check size={10} />
            </button>
            <button onClick={() => onDelete(todo.id)}
              className="w-6 h-6 rounded flex items-center justify-center text-stone-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <X size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Inline edit panel */}
      {editing && editData && (
        <div className="mx-2 mb-1 p-2 bg-stone-800 rounded-lg border border-stone-700" style={{ WebkitAppRegion: 'no-drag' }}>
          <input autoFocus value={editData.title} onChange={e => onChange('title', e.target.value)}
            className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-100 outline-none focus:border-orange-500 mb-1.5" />
          <div className="flex gap-1 mb-1.5">
            {['P1','P2','P3','P4'].map(p => (
              <button key={p} onClick={() => onChange('priority', p)}
                className={`flex-1 text-xs py-0.5 rounded transition-colors ${
                  editData.priority === p ? `${PC[p].bar} text-white` : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
                }`}>{p}</button>
            ))}
          </div>
          <input type="date" value={editData.dueDate || ''} onChange={e => onChange('dueDate', e.target.value)}
            className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-xs text-stone-100 outline-none focus:border-orange-500 mb-1.5" />
          <div className="flex gap-1">
            <button onClick={onSave} className="flex-1 text-xs py-1 bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors">保存</button>
            <button onClick={onCancel} className="flex-1 text-xs py-1 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded transition-colors">取消</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── ContextMenu ──────────────────────────────────────────────
function ContextMenu({ menu, onClose, onAction }) {
  useEffect(() => {
    const close = () => onClose()
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const items = [
    { id: 'edit',     label: '✏️  编辑' },
    { id: 'complete', label: '✅  完成' },
    { id: 'sep' },
    { id: 'p1', label: '🔴  P1 紧急' },
    { id: 'p2', label: '🟠  P2 高' },
    { id: 'p3', label: '🟡  P3 中' },
    { id: 'p4', label: '⚪  P4 低' },
    { id: 'sep2' },
    { id: 'delete', label: '🗑  删除', danger: true },
  ]

  const left = Math.min(menu.x, window.innerWidth  - 148)
  const top  = Math.min(menu.y, window.innerHeight - 220)

  return (
    <div className="fixed z-50 bg-stone-800 border border-stone-700 rounded-xl shadow-2xl py-1 w-36"
      style={{ left, top }} onClick={e => e.stopPropagation()}>
      {items.map((it, i) =>
        it.id.startsWith('sep')
          ? <div key={i} className="my-1 border-t border-stone-700/60" />
          : <button key={it.id} onClick={() => { onAction(it.id, menu.todo); onClose() }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-stone-700/80
                ${it.danger ? 'text-red-400' : 'text-stone-300'}`}>
              {it.label}
            </button>
      )}
    </div>
  )
}

// ─── MiniCalendar ─────────────────────────────────────────────
function MiniCalendar({ todos, selected, onSelect }) {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1).getDay()
  const days  = new Date(year, month + 1, 0).getDate()
  const today = now.getDate()

  const taskMap = {}
  todos.forEach(t => {
    if (t.dueDate) {
      if (!taskMap[t.dueDate]) taskMap[t.dueDate] = []
      taskMap[t.dueDate].push(t.priority)
    }
  })

  function ds(d) {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  const cells = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)

  return (
    <div className="px-2 pb-2 pt-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-stone-500">{month+1}月 {year}</span>
        {selected && <button onClick={() => onSelect(null)} className="text-xs text-orange-400">清除</button>}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {['日','一','二','三','四','五','六'].map(d => (
          <div key={d} className="text-center text-xs text-stone-700 py-0.5 leading-none">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />
          const d = ds(day)
          const isSel  = d === selected
          const isTod  = day === today
          const pts    = taskMap[d] || []
          return (
            <button key={day} onClick={() => onSelect(isSel ? null : d)}
              className={`flex flex-col items-center rounded py-px transition-colors text-xs leading-tight
                ${isSel  ? 'bg-orange-600 text-white'
                : isTod  ? 'bg-orange-500/20 text-orange-400 font-bold'
                : 'text-stone-400 hover:bg-stone-800'}`}>
              {day}
              {pts.length > 0 && (
                <div className="flex gap-px mt-px">
                  {pts.slice(0,3).map((p,j) => (
                    <div key={j} className={`w-1 h-1 rounded-full ${PC[p]?.dot || 'bg-stone-600'}`} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────
function Toast({ msg }) {
  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-stone-700 border border-stone-600 text-stone-100 text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
      {msg}
    </div>
  )
}

// ─── Main FloatingWidget ──────────────────────────────────────
export default function FloatingWidget() {
  const { state, dispatch } = useApp()
  const { todos, user } = state
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI

  // UI
  const [size,         setSize]         = useState('compact')
  const [filter,       setFilter]       = useState('today')
  const [dateFilter,   setDateFilter]   = useState(null)
  const [collapsed,    setCollapsed]    = useState(false)
  const [opacity,      setOpacity]      = useState(1)
  const [pinned,       setPinned]       = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showCal,      setShowCal]      = useState(false)
  const [showPom,      setShowPom]      = useState(false)
  const [toast,        setToast]        = useState(null)

  // Task interaction
  const [editingId, setEditingId] = useState(null)
  const [editData,  setEditData]  = useState(null)
  const [ctxMenu,   setCtxMenu]   = useState(null)
  const [focused,   setFocused]   = useState(-1)
  const [input,     setInput]     = useState('')

  // Pomodoro
  const [pomTime,      setPomTime]      = useState(POMO_WORK)
  const [pomRunning,   setPomRunning]   = useState(false)
  const [pomPhase,     setPomPhase]     = useState('work')
  const [pomDone,      setPomDone]      = useState(0)
  const pomRef = useRef(null)
  const totalTime = pomPhase === 'work' ? POMO_WORK : POMO_BREAK
  const pomProg   = 1 - pomTime / totalTime

  // ── Filtered todos ──
  const filtered = todos.filter(t => {
    if (dateFilter) return t.dueDate === dateFilter && t.status !== 'completed'
    switch (filter) {
      case 'today':   return isToday(t.dueDate) && t.status !== 'completed'
      case 'all':     return t.status !== 'completed'
      case 'p1':      return t.priority === 'P1' && t.status !== 'completed'
      case 'overdue': return isOverdue(t)
      case 'week': {
        if (t.status === 'completed' || !t.dueDate) return false
        const now = new Date()
        const end = new Date(now); end.setDate(now.getDate() + 7)
        const due = new Date(t.dueDate + 'T00:00:00')
        return due >= now && due <= end
      }
      case 'done': return t.status === 'completed'
      default: return true
    }
  }).sort((a, b) => {
    const m = { P1:0, P2:1, P3:2, P4:3 }
    return (m[a.priority]||3) - (m[b.priority]||3)
  })

  // ── Stats ──
  const pendingToday  = todos.filter(t => isToday(t.dueDate) && t.status !== 'completed').length
  const overdueCount  = todos.filter(t => isOverdue(t)).length
  const totalToday    = todos.filter(t => isToday(t.dueDate)).length
  const completedToday= todos.filter(t => t.status === 'completed' && t.completedAt?.startsWith(localDate())).length

  // ── Pomodoro timer ──
  useEffect(() => {
    if (pomRunning) {
      pomRef.current = setInterval(() => {
        setPomTime(prev => {
          if (prev > 1) return prev - 1
          clearInterval(pomRef.current)
          beep()
          if (pomPhase === 'work') {
            setPomDone(c => c + 1)
            setPomPhase('break')
            setPomRunning(true)
            setPomTime(POMO_BREAK)
            showT('🍅 专注完成！休息5分钟')
          } else {
            setPomPhase('work')
            setPomRunning(false)
            setPomTime(POMO_WORK)
            showT('☕ 休息结束，继续加油！')
          }
          return prev
        })
      }, 1000)
    } else {
      clearInterval(pomRef.current)
    }
    return () => clearInterval(pomRef.current)
  }, [pomRunning, pomPhase])

  function showT(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  // ── Size change ──
  function handleSize(mode) {
    setSize(mode)
    if (isElectron) {
      const s = SIZES[mode]
      window.electronAPI.resizeFloatWindow(s.w, s.h)
    }
  }

  // ── Opacity ──
  function handleOpacity(v) {
    setOpacity(v)
    if (isElectron) window.electronAPI.setFloatOpacity(v)
  }

  // ── Pin ──
  function handlePin() {
    const next = !pinned; setPinned(next)
    if (isElectron) window.electronAPI.setFloatAlwaysOnTop(next)
  }

  // ── Add task ──
  function handleAdd() {
    if (!input.trim()) return
    const r = parseNLP(input)
    if (!r.dueDate && filter === 'today') r.dueDate = localDate()
    dispatch({ type: 'ADD_TODO', payload: r })
    setInput('')
  }

  // ── Inline edit ──
  function startEdit(todo) {
    setEditingId(todo.id)
    setEditData({ title: todo.title, priority: todo.priority, dueDate: todo.dueDate || '' })
  }
  function saveEdit() {
    if (editingId && editData) dispatch({ type: 'UPDATE_TODO', payload: { id: editingId, ...editData } })
    setEditingId(null); setEditData(null)
  }
  function cancelEdit() { setEditingId(null); setEditData(null) }
  function changeEdit(f, v) { setEditData(p => ({ ...p, [f]: v })) }

  // ── Context menu ──
  function handleCtxAction(id, todo) {
    switch (id) {
      case 'edit':     startEdit(todo); break
      case 'complete': dispatch({ type: 'COMPLETE_TODO', payload: todo.id }); break
      case 'delete':   dispatch({ type: 'DELETE_TODO', payload: todo.id }); break
      case 'p1': case 'p2': case 'p3': case 'p4':
        dispatch({ type: 'UPDATE_TODO', payload: { id: todo.id, priority: id.toUpperCase() } })
        break
    }
  }

  // ── Keyboard navigation ──
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(i => Math.min(i+1, filtered.length-1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setFocused(i => Math.max(i-1, 0)) }
      else if (e.key === 'Enter' && focused >= 0) {
        dispatch({ type: 'COMPLETE_TODO', payload: filtered[focused].id })
      }
      else if ((e.metaKey||e.ctrlKey) && e.key === 'e' && focused >= 0) { startEdit(filtered[focused]) }
      else if (e.key === 'Tab') {
        e.preventDefault()
        const idx = FILTERS.findIndex(f => f.id === filter)
        setFilter(FILTERS[(idx+1) % FILTERS.length].id)
        setDateFilter(null)
      }
      else if (e.key === 'Escape') { setEditingId(null); setCtxMenu(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused, filtered, filter])

  const isMini = size === 'mini'

  return (
    <div className="flex flex-col h-screen bg-stone-900 text-stone-100 overflow-hidden select-none relative"
      style={{ willChange: 'transform' }}>

      {toast && <Toast msg={toast} />}
      {ctxMenu && <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} onAction={handleCtxAction} />}

      {/* ── Title bar (40px, draggable) ── */}
      <div className="flex items-center gap-1 px-2 bg-stone-950 border-b border-stone-800 flex-shrink-0"
        style={{ height: 40, WebkitAppRegion: 'drag', willChange: 'transform' }}>

        {/* Logo */}
        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
          <div className="w-5 h-5 bg-orange-600 rounded flex items-center justify-center">
            <Zap size={10} className="text-white" />
          </div>
          {!isMini && <span className="text-xs font-semibold text-stone-300">TaskFlow</span>}
        </div>

        {/* Badges */}
        {!isMini && (
          <div className="flex items-center gap-1 ml-1" style={{ WebkitAppRegion: 'no-drag' }}>
            {pendingToday > 0 && (
              <span className="text-xs bg-orange-600 text-white px-1.5 py-0.5 rounded-full leading-none">{pendingToday}</span>
            )}
            {overdueCount > 0 && (
              <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full leading-none">⚠{overdueCount}</span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Pomodoro mini button */}
        <button onClick={() => setShowPom(p => !p)} style={{ WebkitAppRegion: 'no-drag' }}
          className={`relative flex items-center gap-1 px-1 py-0.5 rounded transition-colors
            ${showPom ? 'bg-orange-500/20 text-orange-400' : 'text-stone-600 hover:text-stone-400'}`}>
          <div className="relative" style={{ width: 16, height: 16 }}>
            <Ring r={6} progress={pomProg} color={pomPhase === 'work' ? '#f97316' : '#22c55e'} size={16} />
            {!pomRunning && (
              <Timer size={7} className="absolute text-stone-600" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
            )}
          </div>
          {pomRunning && <span className="text-xs font-mono text-orange-400">{fmt(pomTime)}</span>}
        </button>

        {/* Pin */}
        <button onClick={handlePin} style={{ WebkitAppRegion: 'no-drag' }}
          className={`w-5 h-5 rounded flex items-center justify-center transition-colors
            ${pinned ? 'text-orange-400' : 'text-stone-700 hover:text-stone-400'}`}>
          {pinned ? <Pin size={9} /> : <PinOff size={9} />}
        </button>

        {/* Collapse */}
        <button onClick={() => setCollapsed(c => !c)} style={{ WebkitAppRegion: 'no-drag' }}
          className="w-5 h-5 rounded flex items-center justify-center text-stone-700 hover:text-stone-400 transition-colors">
          {collapsed ? <ChevronDown size={9} /> : <ChevronUp size={9} />}
        </button>

        {/* Window dots */}
        <button onClick={() => isElectron && window.electronAPI.minimizeFloatWindow()}
          style={{ WebkitAppRegion: 'no-drag' }}
          className="w-3 h-3 rounded-full bg-stone-700 hover:bg-yellow-500 transition-colors ml-0.5" />
        <button onClick={() => isElectron && window.electronAPI.hideFloatWindow()}
          style={{ WebkitAppRegion: 'no-drag' }}
          className="w-3 h-3 rounded-full bg-stone-700 hover:bg-red-500 transition-colors" />
      </div>

      {!collapsed && (
        <>
          {/* ── Size selector ── */}
          <div className="flex border-b border-stone-800 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
            {Object.entries(SIZES).map(([mode, info]) => (
              <button key={mode} onClick={() => handleSize(mode)}
                className={`flex-1 text-xs py-1 transition-colors border-b-2 ${
                  size === mode
                    ? 'text-orange-400 bg-orange-500/5 border-orange-500'
                    : 'text-stone-600 hover:text-stone-400 border-transparent'
                }`}>
                {info.label}
              </button>
            ))}
          </div>

          {/* ── Stats bar ── */}
          <div className="flex items-center gap-2 px-3 py-1 bg-stone-950/60 flex-shrink-0 text-xs"
            style={{ WebkitAppRegion: 'no-drag' }}>
            <span className="text-orange-400 font-medium">{user.karma}</span>
            <span className="text-stone-700">·</span>
            {pendingToday > 0 && <span className="text-stone-400">{pendingToday}待办</span>}
            {overdueCount > 0 && <span className="text-red-400">⚠{overdueCount}逾期</span>}
            {totalToday > 0 && <span className="text-stone-600">{completedToday}/{totalToday}完成</span>}
            <span className="ml-auto text-stone-600">🔥{user.streak}</span>
          </div>

          {/* ── Pomodoro panel ── */}
          {showPom && (
            <div className="px-3 py-2 bg-orange-500/5 border-b border-orange-500/20 flex-shrink-0"
              style={{ WebkitAppRegion: 'no-drag' }}>
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
                  <Ring r={19} progress={pomProg} color={pomPhase === 'work' ? '#f97316' : '#22c55e'} size={44} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-orange-300 font-bold">
                    {fmt(pomTime)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-stone-500 mb-1.5">
                    {pomPhase === 'work' ? '🍅 专注' : '☕ 休息'} · 已完成 {pomDone} 个
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setPomRunning(r => !r)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors">
                      {pomRunning ? <><Pause size={9} /> 暂停</> : <><Play size={9} /> 开始</>}
                    </button>
                    <button onClick={() => { setPomRunning(false); setPomTime(pomPhase === 'work' ? POMO_WORK : POMO_BREAK) }}
                      className="p-1 text-stone-600 hover:text-stone-400 hover:bg-stone-800 rounded-lg transition-colors">
                      <RotateCcw size={10} />
                    </button>
                    {pomPhase === 'break' && (
                      <button onClick={() => { setPomPhase('work'); setPomTime(POMO_WORK); setPomRunning(false) }}
                        className="px-2 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-stone-400 rounded-lg transition-colors">
                        跳过
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Opacity settings ── */}
          {showSettings && (
            <div className="px-3 py-1.5 bg-stone-950/80 border-b border-stone-800 flex-shrink-0"
              style={{ WebkitAppRegion: 'no-drag' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-600 w-10">透明度</span>
                <input type="range" min="0.15" max="1" step="0.05" value={opacity}
                  onChange={e => handleOpacity(parseFloat(e.target.value))}
                  className="flex-1 h-1 accent-orange-500 cursor-pointer" />
                <span className="text-xs text-stone-500 w-8 text-right">{Math.round(opacity*100)}%</span>
              </div>
            </div>
          )}

          {/* ── Filter tabs ── */}
          <div className="flex border-b border-stone-800 flex-shrink-0 overflow-x-auto"
            style={{ WebkitAppRegion: 'no-drag' }}>
            {FILTERS.filter(f => isMini ? ['today','p1','overdue'].includes(f.id) : true).map(f => (
              <button key={f.id} onClick={() => { setFilter(f.id); setDateFilter(null) }}
                className={`flex-shrink-0 text-xs px-2.5 py-1 transition-colors border-b-2 ${
                  filter === f.id && !dateFilter
                    ? 'border-orange-500 text-orange-400 bg-orange-500/5'
                    : 'border-transparent text-stone-500 hover:text-stone-300'
                }`}>
                {f.label}
              </button>
            ))}
            {dateFilter && (
              <button onClick={() => setDateFilter(null)}
                className="flex-shrink-0 text-xs px-2 py-1 text-orange-400 border-b-2 border-orange-500 bg-orange-500/5">
                {dateFilter.slice(5)} ×
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Task list (virtual scroll for 30+) ── */}
      <VirtualList
        items={filtered}
        empty={
          <>
            <span className="text-2xl mb-1">✅</span>
            <span>{filter === 'today' ? '今天没有待办' : '没有任务'}</span>
          </>
        }
        renderItem={(todo, i) => (
          <div key={todo.id} onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, todo }) }}>
            <TaskCard
              todo={todo} focused={i === focused}
              onComplete={id => dispatch({ type: 'COMPLETE_TODO', payload: id })}
              onDelete={id => dispatch({ type: 'DELETE_TODO', payload: id })}
              onEdit={startEdit}
              editing={editingId === todo.id} editData={editData}
              onChange={changeEdit} onSave={saveEdit} onCancel={cancelEdit}
            />
          </div>
        )}
      />

      {!collapsed && (
        <>
          {/* ── Mini calendar toggle ── */}
          <div className="flex-shrink-0 border-t border-stone-800" style={{ WebkitAppRegion: 'no-drag' }}>
            <button onClick={() => setShowCal(c => !c)}
              className="w-full flex items-center justify-between px-3 py-1 text-xs text-stone-600 hover:text-stone-400 transition-colors">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {showCal ? '收起日历' : '月历'}
                {dateFilter && <span className="text-orange-400 ml-1">· {dateFilter.slice(5)}</span>}
              </span>
              {showCal ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showCal && (
              <MiniCalendar todos={todos} selected={dateFilter}
                onSelect={d => { setDateFilter(d); if (d) setFilter('') }} />
            )}
          </div>

          {/* ── Quick add ── */}
          <div className="flex-shrink-0 border-t border-stone-800 p-2" style={{ WebkitAppRegion: 'no-drag' }}>
            <div className="flex items-center gap-1.5 bg-stone-800 rounded-lg px-2.5 py-1.5 border border-stone-700 focus-within:border-orange-500 transition-colors">
              <Plus size={11} className="text-stone-500 flex-shrink-0" />
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder={isMini ? '添加...' : 'p1 下周一 #标签'}
                className="flex-1 bg-transparent text-xs text-stone-200 placeholder-stone-700 outline-none min-w-0" />
              {input && (
                <button onClick={handleAdd} className="w-4 h-4 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check size={8} className="text-white" />
                </button>
              )}
            </div>
            <button onClick={() => setShowSettings(s => !s)}
              className="mt-1 w-full text-center text-xs text-stone-800 hover:text-stone-600 transition-colors">
              ⚙ 透明度
            </button>
          </div>
        </>
      )}
    </div>
  )
}
