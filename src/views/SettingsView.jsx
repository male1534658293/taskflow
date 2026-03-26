import React, { useState, useEffect, useRef } from 'react'
import { Shield, Moon, Sun, Trash2, Download, Upload, Check, User, Calendar, Keyboard, Pencil, RefreshCw, Info } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { levelFromKarma } from '../utils/helpers.js'
import GoogleCalendarSync from '../components/GoogleCalendarSync.jsx'

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
  const importRef = useRef(null)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(user.name)
  const [appVersion, setAppVersion] = useState('1.0.0')
  const [updateStatus, setUpdateStatus] = useState(null)
  const [updateInfo, setUpdateInfo] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateError, setUpdateError] = useState(null)
  const [importMsg, setImportMsg] = useState(null)

  const isElectron = !!(window.electronAPI)

  useEffect(() => {
    if (isElectron && window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(v => setAppVersion(v)).catch(() => {})
    }
    if (isElectron && window.electronAPI?.getUpdateStatus) {
      window.electronAPI.getUpdateStatus().then(status => {
        if (status?.available && status?.updateInfo) {
          setUpdateInfo(status.updateInfo)
          setUpdateStatus('available')
        } else {
          setUpdateInfo(null)
        }
        if (status?.downloaded) {
          setUpdateStatus('downloaded')
          setDownloadProgress(100)
        } else if (status?.downloading) {
          setUpdateStatus('downloading')
          setDownloadProgress(status.progress || 0)
        }
      }).catch(() => {})
    }
    if (isElectron && window.electronAPI?.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((_, payload) => {
        setUpdateInfo(payload || null)
        setUpdateStatus('available')
        setUpdateError(null)
      })
    }
    if (isElectron && window.electronAPI?.onUpdateNotAvailable) {
      window.electronAPI.onUpdateNotAvailable(() => {
        setUpdateInfo(null)
        setUpdateStatus('latest')
      })
    }
    if (isElectron && window.electronAPI?.onUpdateDownloading) {
      window.electronAPI.onUpdateDownloading((_, payload) => {
        setUpdateStatus('downloading')
        if (typeof payload?.progress === 'number') setDownloadProgress(payload.progress)
      })
    }
    if (isElectron && window.electronAPI?.onUpdateProgress) {
      window.electronAPI.onUpdateProgress((_, payload) => setDownloadProgress(payload?.progress ?? 0))
    }
    if (isElectron && window.electronAPI?.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateStatus('downloaded')
        setDownloadProgress(100)
      })
    }
    if (isElectron && window.electronAPI?.onUpdateError) {
      window.electronAPI.onUpdateError((_, payload) => {
        setUpdateStatus('error')
        setUpdateError(typeof payload === 'string' ? payload : payload?.message || '下载失败')
      })
    }
  }, []) // eslint-disable-line

  async function handleCheckUpdate() {
    if (!isElectron || !window.electronAPI?.checkForUpdates) {
      setUpdateStatus('dev'); return
    }
    setUpdateStatus('checking')
    setUpdateError(null)
    try {
      const result = await window.electronAPI.checkForUpdates()
      if (result.status === 'dev') {
        setUpdateInfo(null)
        setUpdateStatus('dev')
      } else if (result.status === 'available' && result.updateInfo) {
        setUpdateInfo(result.updateInfo)
        setUpdateStatus('available')
      } else {
        setUpdateInfo(null)
        setUpdateStatus('latest')
      }
    } catch { setUpdateStatus('error') }
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
    const headers = ['ID', '标题', '状态', '优先级', '截止日期', '截止时间', '任务时长(分钟)', '标签', '创建时间', '完成时间']
    const rows = state.todos.map(t => [
      t.id, t.title, t.status, t.priority, t.dueDate || '', t.dueTime || '', t.durationMinutes || '',
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

  function handleImportJSON(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!Array.isArray(data)) throw new Error('格式错误')
        const valid = data.filter(t => t.id && t.title)
        if (valid.length === 0) throw new Error('没有有效任务')
        if (!confirm(`导入 ${valid.length} 条任务？将与现有任务合并（不会删除已有数据）。`)) return
        // 合并：已有 id 的跳过，新 id 的追加
        const existingIds = new Set(state.todos.map(t => t.id))
        const newTodos = valid.filter(t => !existingIds.has(t.id))
        dispatch({ type: 'LOAD_TODOS', payload: [...state.todos, ...newTodos] })
        setImportMsg(`成功导入 ${newTodos.length} 条任务${valid.length - newTodos.length > 0 ? `（${valid.length - newTodos.length} 条已存在，已跳过）` : ''}`)
        setTimeout(() => setImportMsg(null), 4000)
      } catch (err) {
        setImportMsg(`导入失败：${err.message}，请确认为 TaskFlow 导出的 JSON 文件`)
        setTimeout(() => setImportMsg(null), 4000)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
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

      {/* Google Calendar */}
      <Section title="Google 日历同步" icon={Calendar}>
        <GoogleCalendarSync />
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
            <span className="text-stone-300">{todos.length} 条</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">已完成</span>
            <span className="text-stone-300">{todos.filter(t => t.status === 'completed').length} 条</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-stone-400">数据存储</span>
            <span className="text-stone-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              本地 · 隐私安全
            </span>
          </div>
        </div>

        {importMsg && (
          <div className={`mb-3 p-2.5 rounded-lg text-xs ${
            importMsg.includes('失败') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'
          }`}>
            {importMsg}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors border border-stone-700"
          >
            <Download size={12} /> 导出 JSON
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors border border-stone-700"
          >
            <Download size={12} /> 导出 CSV
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors border border-stone-700"
          >
            <Upload size={12} /> 导入 JSON
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          <button
            onClick={handleClearAllData}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors border border-red-500/30"
          >
            <Trash2 size={12} /> 清空所有数据
          </button>
        </div>
        <p className="text-xs text-stone-600 mt-2">导入时与现有数据合并，重复任务自动跳过</p>
      </Section>

      {/* Keyboard shortcuts */}
      <Section title="键盘快捷键" icon={Keyboard}>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[['N', '新建任务'], ['1-5', '切换视图'], ['⌘⇧T', '打开浮窗'], ['Esc', '关闭弹窗']].map(([key, desc]) => (
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
          {/* 重看引导 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-stone-200">新手引导</div>
              <div className="text-xs text-stone-500 mt-0.5">重新查看功能介绍引导</div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('taskflow-onboarded')
                window.location.reload()
              }}
              className="text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors border border-stone-700"
            >
              重新查看
            </button>
          </div>

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
          {updateStatus === 'latest' && <div className="flex items-center gap-1.5 text-xs text-green-400 px-1"><Check size={12} /> 已是最新版本</div>}
          {updateStatus === 'available' && (
            <div className="space-y-2 px-1">
              <div className="flex items-center gap-1.5 text-xs text-orange-400">
                <RefreshCw size={12} />
                {updateInfo?.version ? `发现新版本 v${updateInfo.version}` : '发现新版本'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setUpdateError(null)
                    setUpdateStatus('downloading')
                    window.electronAPI?.downloadUpdate?.()
                  }}
                  className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  立即下载更新
                </button>
                {updateInfo?.releaseUrl && (
                  <a
                    href={updateInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
                  >
                    查看发布页
                  </a>
                )}
              </div>
            </div>
          )}
          {updateStatus === 'downloading' && (
            <div className="px-1 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-orange-400 flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin" /> 正在下载更新…</span>
                <span className="text-stone-500">{downloadProgress}%</span>
              </div>
              <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
              </div>
            </div>
          )}
          {updateStatus === 'downloaded' && (
            <div className="px-1 space-y-2">
              <div className="text-xs text-green-400">更新包已下载完成，可以直接安装并重启。</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.electronAPI?.installUpdate?.()}
                  className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  安装并重启
                </button>
                {updateInfo?.releaseUrl && (
                  <a
                    href={updateInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
                  >
                    查看发布页
                  </a>
                )}
              </div>
            </div>
          )}
          {updateStatus === 'dev' && <div className="text-xs text-stone-600 px-1">当前通过开发模式启动，自动更新不会生效；需要打包后的 App 才能测试更新。</div>}
          {updateStatus === 'error' && <div className="text-xs text-red-400 px-1">{updateError || '检查失败，请检查网络连接'}</div>}
        </div>
      </Section>

      <p className="text-center text-xs text-stone-700 mt-2">TaskFlow v{appVersion} · 数据本地存储，隐私安全</p>
    </div>
  )
}
