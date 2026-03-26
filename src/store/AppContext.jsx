import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react'
import { priorityKarma } from '../utils/helpers.js'
import {
  isGoogleConnected,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../utils/googleCalendar.js'
import { reviewCard, createCard, isDueToday } from '../utils/srs.js'

const AppContext = createContext(null)

const STORAGE_KEY = 'taskflow-todos'
const USER_KEY = 'taskflow-user'
const LEARNING_KEY = 'taskflow-learning'

function loadTodos() {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return []
}

function loadUser() {
  try {
    const s = localStorage.getItem(USER_KEY)
    if (s) return { ...DEFAULT_USER, ...JSON.parse(s) }
  } catch {}
  return { ...DEFAULT_USER }
}

const SAVED_AT_KEY = 'taskflow-saved-at'

function loadLearning() {
  try {
    const s = localStorage.getItem(LEARNING_KEY)
    if (s) {
      const parsed = JSON.parse(s)
      return {
        cards: [],
        reviewStreak: 0,
        lastReviewDate: null,
        reviewHistory: {},
        settings: { dailyNewCardLimit: 20 },
        ...parsed,
      }
    }
  } catch {}
  return { cards: [], reviewStreak: 0, lastReviewDate: null, reviewHistory: {}, settings: { dailyNewCardLimit: 20 } }
}

const DEFAULT_USER = { name: '', email: '', karma: 0, streak: 0, longestStreak: 0 }

// 初始化主题 class
const savedTheme = (() => { try { return localStorage.getItem('taskflow-theme') || 'light' } catch { return 'light' } })()
document.documentElement.classList.toggle('dark', savedTheme === 'dark')
document.documentElement.classList.toggle('light', savedTheme !== 'dark')

const initialState = {
  todos: loadTodos(),
  currentView: 'today',
  theme: savedTheme,
  focus: { active: false, selectedIds: [], completedFocusIds: [] },
  filters: { search: '', active: [] },
  modals: { taskDetail: null, nlpInput: false, focusSelection: false, celebration: false },
  sync: { status: 'synced', lastSyncTime: new Date().toISOString(), pendingCount: 0 },
  user: loadUser(),
  notifications: [],
  templates: [],
  // Google Calendar 同步队列
  // entry: { op: 'create'|'update'|'delete', todoId?, eventId? }
  gcalQueue: [],
  learning: loadLearning(),
}

// ─── 工具：把 gcalQueue 条目附加到 action result ─────────────────────────────

function queueCreate(todoId) { return { op: 'create', todoId } }
function queueUpdate(todoId) { return { op: 'update', todoId } }
function queueDelete(eventId) { return { op: 'delete', eventId } }

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    case 'SET_VIEW':
      return { ...state, currentView: action.payload }

    case 'TOGGLE_THEME': {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', newTheme === 'dark')
      document.documentElement.classList.toggle('light', newTheme !== 'dark')
      try { localStorage.setItem('taskflow-theme', newTheme) } catch {}
      return { ...state, theme: newTheme }
    }

    // ── 创建任务 ──────────────────────────────────────────────────────────────
    case 'ADD_TODO': {
      const newTodo = {
        id: Date.now().toString(),
        title: action.payload.title || '新任务',
        status: 'todo',
        priority: action.payload.priority || 'P4',
        tags: action.payload.tags || [],
        dueDate: action.payload.dueDate || null,
        dueTime: action.payload.dueTime || null,
        durationMinutes: action.payload.durationMinutes || null,
        recurrence: action.payload.recurrence || null,
        description: action.payload.description || '',
        subtasks: [],
        comments: [],
        gcalEventId: null,
        gcalEventLink: null,
        createdAt: new Date().toISOString(),
        assignedTo: state.user.name,
      }
      return {
        ...state,
        todos: [newTodo, ...state.todos],
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue: [...state.gcalQueue, queueCreate(newTodo.id)],
      }
    }

    // ── 更新任务（gcalOnly 标记仅更新 gcal 字段，不重新入队） ─────────────────
    case 'UPDATE_TODO': {
      const newTodos = state.todos.map(t =>
        t.id === action.payload.id ? { ...t, ...action.payload } : t
      )
      const gcalQueue = action.payload.gcalOnly
        ? state.gcalQueue
        : [...state.gcalQueue, queueUpdate(action.payload.id)]
      return {
        ...state,
        todos: newTodos,
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue,
        modals: {
          ...state.modals,
          taskDetail: state.modals.taskDetail?.id === action.payload.id
            ? { ...state.modals.taskDetail, ...action.payload }
            : state.modals.taskDetail,
        },
      }
    }

    // ── 删除任务（先记录 eventId 再删） ──────────────────────────────────────
    case 'DELETE_TODO': {
      const target = state.todos.find(t => t.id === action.payload)
      const gcalQueue = target?.gcalEventId
        ? [...state.gcalQueue, queueDelete(target.gcalEventId)]
        : state.gcalQueue
      return {
        ...state,
        todos: state.todos.filter(t => t.id !== action.payload),
        modals: { ...state.modals, taskDetail: null },
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue,
      }
    }

    // ── 完成 / 反完成任务 ─────────────────────────────────────────────────────
    case 'COMPLETE_TODO': {
      const todo = state.todos.find(t => t.id === action.payload)
      if (!todo) return state

      const todayStr = (() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      })()

      // ── 重复任务：今天完成 / 撤销今天完成 ──────────────────────────────────
      if (todo.recurrence) {
        const isCompletingToday = todo.lastCompletedDate !== todayStr
        const karmaChange = isCompletingToday ? priorityKarma(todo.priority) : -priorityKarma(todo.priority)
        const newTodos = state.todos.map(t =>
          t.id === action.payload
            ? { ...t, lastCompletedDate: isCompletingToday ? todayStr : null }
            : t
        )
        return {
          ...state,
          todos: newTodos,
          user: { ...state.user, karma: Math.max(0, state.user.karma + karmaChange) },
          sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
          gcalQueue: [...state.gcalQueue, queueUpdate(action.payload)],
        }
      }

      // ── 非重复任务：永久完成 / 撤销 ────────────────────────────────────────
      const isCompleting = todo.status !== 'completed'
      const karmaChange = isCompleting ? priorityKarma(todo.priority) : -priorityKarma(todo.priority)

      const newTodos = state.todos.map(t =>
        t.id === action.payload
          ? {
              ...t,
              status: isCompleting ? 'completed' : 'todo',
              completedAt: isCompleting ? new Date().toISOString() : null,
              gcalEventId: isCompleting ? null : t.gcalEventId,
              gcalEventLink: isCompleting ? null : t.gcalEventLink,
            }
          : t
      )

      let newFocus = state.focus
      let showCelebration = false
      if (state.focus.active && isCompleting) {
        const newCompleted = state.focus.selectedIds.includes(action.payload)
          ? [...new Set([...state.focus.completedFocusIds, action.payload])]
          : state.focus.completedFocusIds
        newFocus = { ...state.focus, completedFocusIds: newCompleted }
        if (state.focus.selectedIds.every(id => newCompleted.includes(id)) && state.focus.selectedIds.length > 0) {
          showCelebration = true
        }
      }

      // 完成 → 从 Google 日历删除；撤销完成 → 重新创建
      let gcalEntry
      if (isCompleting && todo.gcalEventId) {
        gcalEntry = queueDelete(todo.gcalEventId)
      } else if (!isCompleting) {
        gcalEntry = queueCreate(action.payload)
      }

      return {
        ...state,
        todos: newTodos,
        focus: newFocus,
        user: { ...state.user, karma: Math.max(0, state.user.karma + karmaChange) },
        modals: { ...state.modals, celebration: showCelebration || state.modals.celebration },
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue: gcalEntry ? [...state.gcalQueue, gcalEntry] : state.gcalQueue,
      }
    }

    case 'START_DOING': {
      const newTodos = state.todos.map(t =>
        t.id === action.payload ? { ...t, status: 'doing' } : t
      )
      return {
        ...state,
        todos: newTodos,
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue: [...state.gcalQueue, queueUpdate(action.payload)],
      }
    }

    // ── 切换子任务完成状态（全完成时自动完成主任务） ──────────────────────────
    case 'TOGGLE_SUBTASK': {
      const { todoId, subtaskId } = action.payload
      let newTodos = state.todos.map(t => {
        if (t.id !== todoId) return t
        return {
          ...t,
          subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s),
        }
      })

      // 子任务全完成 → 自动完成主任务
      let karmaGain = 0
      const updated = newTodos.find(t => t.id === todoId)
      if (
        updated &&
        updated.subtasks.length > 0 &&
        updated.subtasks.every(s => s.done) &&
        updated.status !== 'completed'
      ) {
        newTodos = newTodos.map(t =>
          t.id === todoId
            ? { ...t, status: 'completed', completedAt: new Date().toISOString() }
            : t
        )
        karmaGain = priorityKarma(updated.priority)
      }

      const afterUpdate = newTodos.find(t => t.id === todoId)
      return {
        ...state,
        todos: newTodos,
        user: karmaGain > 0 ? { ...state.user, karma: state.user.karma + karmaGain } : state.user,
        modals: {
          ...state.modals,
          taskDetail: state.modals.taskDetail?.id === todoId ? afterUpdate : state.modals.taskDetail,
        },
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue: [...state.gcalQueue, queueUpdate(todoId)],
      }
    }

    case 'ADD_SUBTASK': {
      const { todoId, title } = action.payload
      const newSubtask = { id: Date.now().toString(), title, done: false }
      const newTodos = state.todos.map(t =>
        t.id === todoId ? { ...t, subtasks: [...(t.subtasks || []), newSubtask] } : t
      )
      const updatedTask = newTodos.find(t => t.id === todoId)
      return {
        ...state,
        todos: newTodos,
        modals: {
          ...state.modals,
          taskDetail: state.modals.taskDetail?.id === todoId ? updatedTask : state.modals.taskDetail,
        },
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue: [...state.gcalQueue, queueUpdate(todoId)],
      }
    }

    // ── Focus ─────────────────────────────────────────────────────────────────
    case 'TOGGLE_FOCUS_TASK': {
      const { selectedIds } = state.focus
      const id = action.payload
      const newSelected = selectedIds.includes(id)
        ? selectedIds.filter(s => s !== id)
        : selectedIds.length >= 7 ? selectedIds : [...selectedIds, id]
      return { ...state, focus: { ...state.focus, selectedIds: newSelected } }
    }

    case 'ACTIVATE_FOCUS':
      return {
        ...state,
        focus: { ...state.focus, active: true, completedFocusIds: [] },
        modals: { ...state.modals, focusSelection: false },
      }

    case 'DEACTIVATE_FOCUS':
      return { ...state, focus: { active: false, selectedIds: [], completedFocusIds: [] } }

    // ── Modals ────────────────────────────────────────────────────────────────
    case 'OPEN_TASK_DETAIL':
      return { ...state, modals: { ...state.modals, taskDetail: action.payload } }
    case 'CLOSE_TASK_DETAIL':
      return { ...state, modals: { ...state.modals, taskDetail: null } }
    case 'TOGGLE_NLP_INPUT':
      return { ...state, modals: { ...state.modals, nlpInput: !state.modals.nlpInput } }
    case 'OPEN_FOCUS_SELECTION':
      return { ...state, modals: { ...state.modals, focusSelection: true } }
    case 'CLOSE_FOCUS_SELECTION':
      return { ...state, modals: { ...state.modals, focusSelection: false } }
    case 'CLOSE_CELEBRATION':
      return { ...state, modals: { ...state.modals, celebration: false } }

    // ── Filters ───────────────────────────────────────────────────────────────
    case 'TOGGLE_FILTER': {
      const { active } = state.filters
      const filter = action.payload
      const newActive = active.includes(filter)
        ? active.filter(f => f !== filter)
        : [...active, filter]
      return { ...state, filters: { ...state.filters, active: newActive } }
    }
    case 'SET_SEARCH':
      return { ...state, filters: { ...state.filters, search: action.payload } }
    case 'CLEAR_FILTERS':
      return { ...state, filters: { search: '', active: [] } }

    // ── Comments ──────────────────────────────────────────────────────────────
    case 'ADD_COMMENT': {
      const { todoId, comment } = action.payload
      const newTodos = state.todos.map(t =>
        t.id === todoId
          ? {
              ...t,
              comments: [
                ...t.comments,
                { id: Date.now().toString(), author: state.user.name, content: comment, createdAt: new Date().toISOString() },
              ],
            }
          : t
      )
      const updatedTask = newTodos.find(t => t.id === todoId)
      return {
        ...state,
        todos: newTodos,
        modals: {
          ...state.modals,
          taskDetail: state.modals.taskDetail?.id === todoId ? updatedTask : state.modals.taskDetail,
        },
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
      }
    }

    // ── Bulk operations ───────────────────────────────────────────────────────
    case 'BULK_COMPLETE': {
      const ids = action.payload
      const now = new Date().toISOString()
      let karmaGain = 0
      const newTodos = state.todos.map(t => {
        if (ids.includes(t.id) && t.status !== 'completed') {
          karmaGain += priorityKarma(t.priority)
          return { ...t, status: 'completed', completedAt: now }
        }
        return t
      })
      const newQueue = ids.reduce((q, id) => [...q, queueUpdate(id)], state.gcalQueue)
      return {
        ...state,
        todos: newTodos,
        user: { ...state.user, karma: state.user.karma + karmaGain },
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue: newQueue,
      }
    }

    case 'BULK_DELETE': {
      const ids = action.payload
      const newTodos = state.todos.filter(t => !ids.includes(t.id))
      const deleteEntries = state.todos
        .filter(t => ids.includes(t.id) && t.gcalEventId)
        .map(t => queueDelete(t.gcalEventId))
      return {
        ...state,
        todos: newTodos,
        modals: {
          ...state.modals,
          taskDetail: ids.includes(state.modals.taskDetail?.id) ? null : state.modals.taskDetail,
        },
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue: [...state.gcalQueue, ...deleteEntries],
      }
    }

    case 'BULK_SET_PRIORITY': {
      const { ids, priority } = action.payload
      const newTodos = state.todos.map(t => ids.includes(t.id) ? { ...t, priority } : t)
      const newQueue = ids.reduce((q, id) => [...q, queueUpdate(id)], state.gcalQueue)
      return {
        ...state,
        todos: newTodos,
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue: newQueue,
      }
    }

    // ── Templates ─────────────────────────────────────────────────────────────
    case 'ADD_TEMPLATE': {
      const { name, todo } = action.payload
      return { ...state, templates: [...state.templates, { id: Date.now().toString(), name, ...todo }] }
    }

    case 'USE_TEMPLATE': {
      const template = state.templates.find(t => t.id === action.payload)
      if (!template) return state
      const { id: _id, name: _name, ...data } = template
      const newTodo = { ...data, id: Date.now().toString(), status: 'todo', createdAt: new Date().toISOString(), subtasks: [], comments: [], gcalEventId: null, gcalEventLink: null }
      return {
        ...state,
        todos: [newTodo, ...state.todos],
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
        gcalQueue: [...state.gcalQueue, queueCreate(newTodo.id)],
      }
    }

    // ── Pomodoro ──────────────────────────────────────────────────────────────
    case 'COMPLETE_POMODORO': {
      const todoId = action.payload
      const newTodos = state.todos.map(t =>
        t.id === todoId ? { ...t, pomodoroCount: (t.pomodoroCount || 0) + 1 } : t
      )
      const updatedTask = newTodos.find(t => t.id === todoId)
      return {
        ...state,
        todos: newTodos,
        user: { ...state.user, karma: state.user.karma + 5 },
        modals: {
          ...state.modals,
          taskDetail: state.modals.taskDetail?.id === todoId ? updatedTask : state.modals.taskDetail,
        },
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
      }
    }

    // ── Sync ──────────────────────────────────────────────────────────────────
    case 'SYNC_COMPLETE':
      return {
        ...state,
        sync: { ...state.sync, status: 'synced', lastSyncTime: new Date().toISOString(), pendingCount: 0 },
      }

    case 'LOAD_TODOS':
      return { ...state, todos: action.payload }

    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } }

    // Google Calendar：把 eventId 写回 todo（gcalOnly 不触发再次同步）
    case 'SET_GCAL_EVENT': {
      const { todoId, eventId, eventLink } = action.payload
      const newTodos = state.todos.map(t =>
        t.id === todoId ? { ...t, gcalEventId: eventId, gcalEventLink: eventLink || null } : t
      )
      return { ...state, todos: newTodos }
    }

    // 重新同步单个任务到 Google 日历（点击"未同步"标记时触发）
    case 'RESYNC_TODO_GCAL':
      return {
        ...state,
        gcalQueue: [...state.gcalQueue, queueCreate(action.payload)],
        sync: { ...state.sync, status: 'syncing', pendingCount: state.sync.pendingCount + 1 },
      }

    // 清空已处理的队列条目
    case 'DEQUEUE_GCAL':
      return { ...state, gcalQueue: state.gcalQueue.slice(action.payload) }

    // ── 清理今天（把今天的任务移到明天）────────────────────────────────────────
    case 'CLEAR_TODAY': {
      const todayD = new Date()
      const todayS = `${todayD.getFullYear()}-${String(todayD.getMonth()+1).padStart(2,'0')}-${String(todayD.getDate()).padStart(2,'0')}`
      const tom = new Date(todayD); tom.setDate(tom.getDate() + 1)
      const tomS = `${tom.getFullYear()}-${String(tom.getMonth()+1).padStart(2,'0')}-${String(tom.getDate()).padStart(2,'0')}`
      const changedIds = []
      const newTodos = state.todos.map(t => {
        if (t.status === 'completed' || t.recurrence) return t
        if (t.dueDate === todayS) { changedIds.push(t.id); return { ...t, dueDate: tomS } }
        return t
      })
      return {
        ...state,
        todos: newTodos,
        gcalQueue: [...state.gcalQueue, ...changedIds.map(id => queueUpdate(id))],
        sync: { ...state.sync, pendingCount: state.sync.pendingCount + 1, status: 'syncing' },
      }
    }

    // ── iCloud 数据加载 ────────────────────────────────────────────────────────
    case 'LOAD_ICLOUD_DATA':
      return {
        ...state,
        todos: action.payload.todos || state.todos,
        learning: action.payload.learning
          ? { ...loadLearning(), ...action.payload.learning }
          : state.learning,
      }

    // ── 学习记录 ──────────────────────────────────────────────────────────────
    case 'ADD_LEARNING_CARD': {
      const card = createCard(action.payload)
      return { ...state, learning: { ...state.learning, cards: [...state.learning.cards, card] } }
    }

    case 'UPDATE_LEARNING_CARD': {
      const cards = state.learning.cards.map(c =>
        c.id === action.payload.id ? { ...c, ...action.payload } : c
      )
      return { ...state, learning: { ...state.learning, cards } }
    }

    case 'DELETE_LEARNING_CARD': {
      const cards = state.learning.cards.filter(c => c.id !== action.payload)
      return { ...state, learning: { ...state.learning, cards } }
    }

    case 'BURY_CARD': {
      const tom = new Date(); tom.setDate(tom.getDate() + 1)
      const tomStr = tom.toISOString().slice(0, 10)
      const cards = state.learning.cards.map(c =>
        c.id === action.payload ? { ...c, buriedUntil: tomStr } : c
      )
      return { ...state, learning: { ...state.learning, cards } }
    }

    case 'SUSPEND_CARD': {
      const cards = state.learning.cards.map(c =>
        c.id === action.payload ? { ...c, suspended: true } : c
      )
      return { ...state, learning: { ...state.learning, cards } }
    }

    case 'UNSUSPEND_CARD': {
      const cards = state.learning.cards.map(c =>
        c.id === action.payload ? { ...c, suspended: false, buriedUntil: null } : c
      )
      return { ...state, learning: { ...state.learning, cards } }
    }

    case 'UPDATE_LEARNING_SETTINGS': {
      return {
        ...state,
        learning: { ...state.learning, settings: { ...state.learning.settings, ...action.payload } },
      }
    }

    case 'REVIEW_LEARNING_CARD': {
      const { id, rating } = action.payload
      const card = state.learning.cards.find(c => c.id === id)
      if (!card) return state
      const updated = reviewCard(card, rating)
      const cards = state.learning.cards.map(c => c.id === id ? updated : c)
      // 更新复习连续天数
      const today = new Date().toISOString().slice(0, 10)
      const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
      const { reviewStreak, lastReviewDate } = state.learning
      const newStreak = lastReviewDate === today ? reviewStreak
        : lastReviewDate === yesterday ? reviewStreak + 1
        : 1
      // 更新热力图
      const reviewHistory = {
        ...(state.learning.reviewHistory || {}),
        [today]: ((state.learning.reviewHistory || {})[today] || 0) + 1,
      }
      return {
        ...state,
        learning: { ...state.learning, cards, reviewStreak: newStreak, lastReviewDate: today, reviewHistory },
        user: { ...state.user, karma: state.user.karma + 2 },
      }
    }

    default:
      return state
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const processingRef = useRef(false)
  const icloudTimerRef = useRef(null)

  // 持久化 todos
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos)) } catch {}
  }, [state.todos])

  // 持久化 user
  useEffect(() => {
    try { localStorage.setItem(USER_KEY, JSON.stringify(state.user)) } catch {}
  }, [state.user])

  // 持久化学习记录
  useEffect(() => {
    try { localStorage.setItem(LEARNING_KEY, JSON.stringify(state.learning)) } catch {}
  }, [state.learning])

  // iCloud 同步：数据变化后 5s 写入（防抖）
  useEffect(() => {
    if (!window.electronAPI?.icloudSave) return
    clearTimeout(icloudTimerRef.current)
    icloudTimerRef.current = setTimeout(() => {
      const savedAt = Date.now()
      try { localStorage.setItem(SAVED_AT_KEY, savedAt.toString()) } catch {}
      window.electronAPI.icloudSave({ todos: state.todos, learning: state.learning, savedAt })
    }, 5000)
  }, [state.todos, state.learning]) // eslint-disable-line react-hooks/exhaustive-deps

  // iCloud 启动时加载（如果 iCloud 数据更新）
  useEffect(() => {
    if (!window.electronAPI?.icloudLoad) return
    window.electronAPI.icloudLoad().then(result => {
      if (!result?.success || !result.data) return
      const localSavedAt = parseInt(localStorage.getItem(SAVED_AT_KEY) || '0')
      if ((result.data.savedAt || 0) > localSavedAt) {
        dispatch({ type: 'LOAD_ICLOUD_DATA', payload: result.data })
        try { localStorage.setItem(SAVED_AT_KEY, result.data.savedAt.toString()) } catch {}
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 跨窗口同步（浮窗 ↔ 主窗口）
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { dispatch({ type: 'LOAD_TODOS', payload: JSON.parse(e.newValue) }) } catch {}
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Auto-sync 状态
  useEffect(() => {
    if (state.sync.pendingCount > 0) {
      const timer = setTimeout(() => dispatch({ type: 'SYNC_COMPLETE' }), 2000)
      return () => clearTimeout(timer)
    }
  }, [state.sync.pendingCount])

  // ── Google Calendar 同步队列处理 ─────────────────────────────────────────
  useEffect(() => {
    if (state.gcalQueue.length === 0) return
    if (processingRef.current) return
    if (!isGoogleConnected()) {
      dispatch({ type: 'DEQUEUE_GCAL', payload: state.gcalQueue.length })
      return
    }

    processingRef.current = true
    const batch = [...state.gcalQueue]
    dispatch({ type: 'DEQUEUE_GCAL', payload: batch.length })

    // 使用 state 的快照（stale closure 安全：通过 id 查找）
    const todosSnapshot = state.todos

    ;(async () => {
      for (const entry of batch) {
        try {
          if (entry.op === 'create') {
            const todo = todosSnapshot.find(t => t.id === entry.todoId)
            if (!todo) continue
            const result = await createCalendarEvent(todo)
            if (result.success && result.eventId) {
              dispatch({
                type: 'SET_GCAL_EVENT',
                payload: { todoId: entry.todoId, eventId: result.eventId, eventLink: result.eventLink },
              })
            }

          } else if (entry.op === 'update') {
            const todo = todosSnapshot.find(t => t.id === entry.todoId)
            if (!todo) continue
            if (todo.gcalEventId) {
              await updateCalendarEvent(todo.gcalEventId, todo)
            } else {
              // 没有 eventId 说明之前创建失败或是老数据，重新创建
              const result = await createCalendarEvent(todo)
              if (result.success && result.eventId) {
                dispatch({
                  type: 'SET_GCAL_EVENT',
                  payload: { todoId: entry.todoId, eventId: result.eventId, eventLink: result.eventLink },
                })
              }
            }

          } else if (entry.op === 'delete') {
            if (entry.eventId) {
              await deleteCalendarEvent(entry.eventId)
            }
          }
        } catch (e) {
          console.warn('[GCal sync]', e)
        }
      }
      processingRef.current = false
    })()
  }, [state.gcalQueue]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
