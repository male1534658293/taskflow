import React, { useState, useEffect } from 'react'
import { Shield, Moon, Sun, Trash2, Download, Check, User, Calendar, Keyboard, Pencil, Bell, BellOff, RefreshCw, Info } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { levelFromKarma } from '../utils/helpers.js'
import GoogleCalendarSync from '../components/GoogleCalendarSync.jsx'

const REMINDER_KEY = 'taskflow-reminder'

function loadReminder() {
  try { return JSON.parse(localStorage.getItem(REMINDER_KEY) || 'null') } catch { return null }
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-orange-400" />
        <h2 className="text-sm font-semibold text-stone-200">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function SettingsView() {
  const { state, dispatch } = useApp()
  const { user, theme, todos } = state

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(user.name)
  const [appVersion, setAppVersion] = useState('1.0.0')
  const [updateStatus, setUpdateStatus] = useState(null) // null | 'checking' | 'latest' | 'available' | 'error'

  // ── 工作日提醒 ──────────────────────────────────────────────────────────────
  const savedReminder = loadReminder()
  const [reminderEnabled, setReminderEnabled] = useState(savedReminder?.enabled ?? false)
  const [reminderTime, setReminderTime] = useState(savedReminder?.time ?? '09:00')
  const [nextReminderTime, setNextReminderTime] = useState(null)

  const isElectron = !!(window.electronAPI?.setReminder)

  async function applyReminder(enabled, time) {
    const config = { enabled, time }
    localStorage.setItem(REMINDER_KEY, JSON.stringify(config))
    setReminderEnabled(enabled)
    if (!isElectron) return

    if (enabled) {
      const todosJson = JSON.stringify(todos)
      const result = await window.electronAPI.setReminder(time, todosJson)
      if (result?.nextTime) {
        setNextReminderTime(new Date(result.nextTime))
      }
    } else {
      window.electronAPI.clearReminder()
      setNextReminderTime(null)
    }
  }

  // 应用启动时恢复提醒
  useEffect(() => {
    if (reminderEnabled && isElectron) {
      window.electronAPI.setReminder(reminderTime, JSON.stringify(todos)).then(r => {
        if (r?.nextTime) setNextReminderTime(new Date(r.nextTime))
      })
    }
  }, []) // eslint-disable-line

  // todos 变化时同步给主进程（让提醒内容保持最新）
  useEffect(() => {
    if (reminderEnabled && isElectron) {
      window.electronAPI.updateReminderTodos(JSON.stringify(todos))
    }
  }, [todos, reminderEnabled]) // eslint-disable-line

  // Get app version
  useEffect(() => {
    if (isElectron && window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(v => setAppVersion(v)).catch(() => {})
    }
  }, []) // eslint-disable-line

  async function handleCheckUpdate() {
    if (!isElectron || !window.electronAPI?.checkForUpdates) {
      setUpdateStatus('latest')
      return
    }
    setUpdateStatus('checking')
    try {
      const result = await window.electronAPI.checkForUpdates()
      if (result.status === 'dev') {
        setUpdateStatus('dev')
      } else if (result.updateInfo && result.updateInfo.version !== result.version) {
        setUpdateStatus('available')
      } else {
        setUpdateStatus('latest')
      }
    } catch {
      setUpdateStatus('error')
    }
  }

  const level = levelFromKarma(user.karma)

  function saveName() {
    const name = nameInput.trim()
    if (name) dispatch({ type: 'UPDATE_USER', payload: { name } })
    setEditingName(false)
  }

  function handleExportJSON() {
    const data = JSON.stringify(state.todos, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `taskflow-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportCSV() {
    const headers = ['ID', '标题', '状态', '优先级', '截止日期', '截止时间', '标签', '创建时间', '完成时间']
    const rows = state.todos.map(t => [
      t.id, t.title, t.status, t.priority, t.dueDate || '', t.dueTime || '',
      (t.tags || []).join(';'), t.createdAt || '', t.completedAt || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `taskflow-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleClearAllData() {
    if (!confirm('确定要清空所有任务数据吗？此操作不可撤销。')) return
    dispatch({ type: 'LOAD_TODOS', payload: [] })
  }

  const initial = (user.name || '?')[0].toUpperCase()

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-stone-100">设置</h1>
        <p className="text-sm text-stone-500 mt-0.5">账户与偏好配置</p>
      </div>

      {/* Account */}
      <Section title="账户" icon={User}>
        <div className="flex items-center gap-3 p-3 bg-stone-800/50 rounded-xl">
          <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                  className="flex-1 bg-stone-700 border border-stone-600 text-stone-100 text-sm px-2 py-1 rounded-lg outline-none focus:border-orange-500"
                  placeholder="输入你的名字"
                />
                <button onClick={saveName} className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded-lg">保存</button>
                <button onClick={() => setEditingName(false)} className="text-xs text-stone-500 hover:text-stone-300 px-1">取消</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-stone-200">
                  {user.name || <span className="text-stone-500 italic">未设置昵称</span>}
                </span>
                <button onClick={() => { setNameInput(user.name); setEditingName(true) }} className="text-stone-600 hover:text-orange-400 transition-colors">
                  <Pencil size={13} />
                </button>
              </div>
            )}
            <div className="text-xs text-stone-500 mt-0.5">{level.label} · {user.karma} Karma</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-xs text-stone-500">连续</div>
            <div className="text-sm font-bold text-orange-400">{user.streak} 天</div>
          </div>
        </div>
      </Section>

      {/* Google Calendar Integration */}
      <Section title="Google 日历同步" icon={Calendar}>
        <GoogleCalendarSync />
      </Section>

      {/* Workday Reminder */}
      <Section title="工作日提醒" icon={reminderEnabled ? Bell : BellOff}>
        <div className="space-y-3">
          {/* 开关 + 时间 */}
          <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-xl">
            <div className="flex-1">
              <div className="text-sm font-medium text-stone-200">每日工作提醒</div>
              <div className="text-xs text-stone-500 mt-0.5">
                工作日（排除节假日）在指定时间发送通知
              </div>
            </div>
            <button
              onClick={() => applyReminder(!reminderEnabled, reminderTime)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ml-3 ${
                reminderEnabled ? 'bg-orange-600' : 'bg-stone-600'
              }`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                reminderEnabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* 时间选择器 */}
          <div className="flex items-center gap-3 px-1">
            <span className="text-xs text-stone-400 w-16">提醒时间</span>
            <input
              type="time"
              value={reminderTime}
              onChange={e => {
                setReminderTime(e.target.value)
                if (reminderEnabled) applyReminder(true, e.target.value)
              }}
              className="bg-stone-800 border border-stone-700 text-stone-200 text-sm px-3 py-1.5 rounded-lg outline-none focus:border-orange-500 transition-colors"
            />
            {reminderEnabled && nextReminderTime && (
              <span className="text-xs text-stone-500">
                下次：{nextReminderTime.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' })} {nextReminderTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* 通知内容说明 */}
          {reminderEnabled && (
            <div className="flex items-start gap-2 p-2.5 bg-orange-500/8 border border-orange-500/15 rounded-lg">
              <Bell size={12} className="text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-stone-500 leading-relaxed">
                通知内容包含今日待办数量及第一条任务标题，点击通知可直接打开应用
              </p>
            </div>
          )}

          {!isElectron && (
            <p className="text-xs text-stone-600">仅桌面应用支持系统通知</p>
          )}
        </div>
      </Section>

      {/* Theme */}
      <Section title="外观主题" icon={theme === 'dark' ? Moon : Sun}>
        <div className="flex items-center justify-between p-3 bg-stone-800/50 rounded-xl">
          <div>
            <div className="text-sm font-medium text-stone-200">
              {theme === 'dark' ? '🌙 深色模式' : '☀️ 浅色模式'}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">点击切换主题</div>
          </div>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              theme === 'dark' ? 'bg-orange-600' : 'bg-stone-400'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </Section>

      {/* Data */}
      <Section title="数据管理" icon={Shield}>
        <div className="space-y-2.5 mb-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-stone-400">任务总数</span>
            <span className="text-stone-300">{state.todos.length} 条</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">已完成</span>
            <span className="text-stone-300">{state.todos.filter(t => t.status === 'completed').length} 条</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">数据存储</span>
            <span className="text-stone-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              本地 · 隐私安全
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors border border-stone-700"
          >
            <Download size={12} />
            导出 JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors border border-stone-700"
          >
            <Download size={12} />
            导出 CSV
          </button>
          <button
            onClick={handleClearAllData}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors border border-red-500/30"
          >
            <Trash2 size={12} />
            清空所有数据
          </button>
        </div>
      </Section>

      {/* Keyboard shortcuts */}
      <Section title="键盘快捷键" icon={Keyboard}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ['N', '新建任务'],
            ['1-5', '切换视图'],
            ['⌘⇧T', '打开浮窗'],
            ['Esc', '关闭弹窗'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center gap-2 p-2 bg-stone-800/50 rounded-lg">
              <kbd className="bg-stone-700 text-stone-300 px-2 py-0.5 rounded text-xs font-mono">{key}</kbd>
              <span className="text-stone-400">{desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* About & Updates */}
      <Section title="关于 & 更新" icon={Info}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-stone-200">TaskFlow</div>
              <div className="text-xs text-stone-500 mt-0.5">版本 v{appVersion} · 个人任务管理工具</div>
            </div>
            <button
              onClick={handleCheckUpdate}
              disabled={updateStatus === 'checking'}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors border border-stone-700 disabled:opacity-50"
            >
              <RefreshCw size={12} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
              {updateStatus === 'checking' ? '检查中…' : '检查更新'}
            </button>
          </div>

          {updateStatus === 'latest' && (
            <div className="flex items-center gap-1.5 text-xs text-green-400 px-1">
              <Check size={12} /> 已是最新版本
            </div>
          )}
          {updateStatus === 'available' && (
            <div className="flex items-center gap-1.5 text-xs text-orange-400 px-1">
              <RefreshCw size={12} /> 发现新版本，正在后台下载…
            </div>
          )}
          {updateStatus === 'dev' && (
            <div className="text-xs text-stone-600 px-1">开发模式，跳过更新检查</div>
          )}
          {updateStatus === 'error' && (
            <div className="text-xs text-red-400 px-1">检查失败，请检查网络连接</div>
          )}
        </div>
      </Section>

      <p className="text-center text-xs text-stone-700 mt-2">TaskFlow v{appVersion} · 数据本地存储，隐私安全</p>
    </div>
  )
}
