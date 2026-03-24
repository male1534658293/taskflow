import React, { useState } from 'react'
import { Check, AlertCircle, Loader2, ChevronDown, ChevronUp, RefreshCw, ExternalLink, Key } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import {
  requestGoogleAccess,
  revokeGoogleAccess,
  isGoogleConnected,
  getGoogleEmail,
  hasCredentials,
  saveCredentials,
  clearSavedCredentials,
  pullGoogleCalendarEvents,
} from '../utils/googleCalendar.js'

export default function GoogleCalendarSync({ onConnectionChange }) {
  const { state, dispatch } = useApp()

  const [hasCreds, setHasCreds] = useState(hasCredentials)
  const [showCredForm, setShowCredForm] = useState(!hasCredentials())
  const [clientId, setClientId] = useState(() => localStorage.getItem('gcal_client_id') || '')
  const [clientSecret, setClientSecret] = useState(() => localStorage.getItem('gcal_client_secret') || '')

  const [connected, setConnected] = useState(isGoogleConnected)
  const [email, setEmail] = useState(getGoogleEmail)
  const [loading, setLoading] = useState(false)
  const [waitingBrowser, setWaitingBrowser] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('gcal_last_pull') || null)
  const [error, setError] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

  function handleSaveCredentials() {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError('请填写 Client ID 和 Client Secret')
      return
    }
    saveCredentials(clientId, clientSecret)
    setHasCreds(true)
    setShowCredForm(false)
    setError(null)
  }

  function handleClearCredentials() {
    clearSavedCredentials()
    setHasCreds(false)
    setShowCredForm(true)
    setClientId('')
    setClientSecret('')
  }

  async function handleConnect() {
    setLoading(true)
    setWaitingBrowser(true)
    setError(null)

    const result = await requestGoogleAccess()
    setLoading(false)
    setWaitingBrowser(false)

    if (result.success) {
      setConnected(true)
      setEmail(getGoogleEmail())
      onConnectionChange?.(true, getGoogleEmail())
    } else {
      const msg = result.error === 'access_denied' ? '授权被拒绝，请重试'
        : result.error === 'timeout' ? '授权超时（5 分钟），请重试'
        : result.error === 'cancelled' ? '授权已取消'
        : result.error || '连接失败，请重试'
      setError(msg)
    }
  }

  function handleDisconnect() {
    revokeGoogleAccess()
    setConnected(false)
    setEmail('')
    setSyncResult(null)
    setError(null)
    onConnectionChange?.(false, '')
  }

  async function handlePullSync(importExternal = false) {
    setSyncing(true)
    setSyncResult(null)
    setError(null)

    const result = await pullGoogleCalendarEvents(state.todos, importExternal)
    setSyncing(false)

    if (!result.success) {
      if (result.error === 'token_expired') {
        setConnected(false)
        setError('登录已过期，请重新连接 Google 账户')
      } else {
        setError(result.error || '同步失败，请重试')
      }
      return
    }

    // 将在 Google 中被删除的事件的 gcalEventId 清除（保留本地 todo，仅解除关联）
    for (const todoId of result.gcalDeleted) {
      dispatch({ type: 'UPDATE_TODO', payload: { id: todoId, gcalEventId: null, gcalOnly: true } })
    }

    // 导入外部 Google Calendar 事件作为新 todo
    if (result.toImport.length > 0) {
      dispatch({ type: 'IMPORT_GCAL_TODOS', payload: result.toImport })
    }

    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    localStorage.setItem('gcal_last_pull', now)
    setLastSyncTime(now)
    setSyncResult({
      gcalDeleted: result.gcalDeleted.length,
      imported: result.toImport.length,
      total: result.total,
    })
  }

  // ── Credential form ──────────────────────────────────────────────────────────

  if (!hasCreds || showCredForm) {
    return (
      <div className="space-y-4">
        {/* How to get credentials guide */}
        <div className="border border-stone-700/60 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowGuide(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-stone-800/50 hover:bg-stone-700/50 transition-colors text-left"
          >
            <span className="text-xs font-medium text-stone-300">如何获取 Google OAuth 凭据（点击展开）</span>
            {showGuide ? <ChevronUp size={13} className="text-stone-500" /> : <ChevronDown size={13} className="text-stone-500" />}
          </button>

          {showGuide && (
            <div className="px-3 pb-3 pt-2 space-y-2.5 bg-stone-800/20 text-xs">
              {[
                ['1', 'blue', '打开 Google Cloud Console', '前往 console.cloud.google.com，创建或选择一个项目'],
                ['2', 'orange', '启用 Google Calendar API', '左侧菜单 → API 和服务 → 库 → 搜索 "Google Calendar API" → 启用'],
                ['3', 'purple', '创建 OAuth 凭据', '左侧菜单 → API 和服务 → 凭据 → 创建凭据 → OAuth 客户端 ID → 选择"桌面应用"'],
                ['4', 'green', '复制凭据', '创建完成后复制 Client ID 和 Client Secret，粘贴到下方'],
              ].map(([num, color, title, desc]) => (
                <div key={num} className="flex gap-2.5">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full bg-${color}-500/20 text-${color}-400 text-[10px] font-bold flex items-center justify-center mt-0.5`}>{num}</div>
                  <div>
                    <p className="font-medium text-stone-300 mb-0.5">{title}</p>
                    <p className="text-stone-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 mt-1"
                onClick={e => { e.preventDefault(); window.electronAPI ? require('electron').shell?.openExternal(e.currentTarget.href) : window.open(e.currentTarget.href) }}
              >
                <ExternalLink size={11} /> 打开 Google Cloud Console
              </a>
            </div>
          )}
        </div>

        {/* Credential inputs */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 mb-1">
            <Key size={13} className="text-orange-400" />
            <span className="text-xs font-medium text-stone-300">输入 OAuth 凭据</span>
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="123456789-xxxx.apps.googleusercontent.com"
              className="w-full bg-stone-800 border border-stone-700 focus:border-orange-500 text-stone-200 text-xs px-3 py-2 rounded-lg outline-none placeholder:text-stone-600"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Client Secret</label>
            <input
              type="password"
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              placeholder="GOCSPX-xxxxxxxxxxxx"
              className="w-full bg-stone-800 border border-stone-700 focus:border-orange-500 text-stone-200 text-xs px-3 py-2 rounded-lg outline-none placeholder:text-stone-600"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle size={12} className="flex-shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSaveCredentials}
              className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              保存凭据
            </button>
            {hasCreds && (
              <button
                onClick={() => setShowCredForm(false)}
                className="px-3 py-2 text-xs text-stone-500 hover:text-stone-300 border border-stone-700 rounded-lg transition-colors"
              >
                取消
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-stone-600 text-center">凭据仅保存在本机，不会上传到任何服务器</p>
      </div>
    )
  }

  // ── Connected state ──────────────────────────────────────────────────────────

  if (connected) {
    return (
      <div className="space-y-3">
        {/* Connected badge */}
        <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <GoogleIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Check size={13} className="text-green-400" />
              <span className="text-sm font-medium text-stone-200">已连接 Google Calendar</span>
            </div>
            {email && <p className="text-xs text-stone-400 mt-0.5 truncate">{email}</p>}
          </div>
          <button
            onClick={handleDisconnect}
            className="flex-shrink-0 text-xs text-stone-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
          >
            断开
          </button>
        </div>

        {/* Auto-push features */}
        <div className="grid grid-cols-2 gap-2 text-xs text-stone-400">
          {['创建任务时自动同步', '颜色按优先级标注', '支持循环任务规则', '30 分钟前弹窗提醒'].map(f => (
            <div key={f} className="flex items-center gap-1.5 p-2 bg-stone-800/50 rounded-lg">
              <Check size={12} className="text-green-400" /> {f}
            </div>
          ))}
        </div>

        {/* Pull sync section */}
        <div className="border border-stone-700/50 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-stone-300">从 Google 同步</p>
              <p className="text-xs text-stone-500 mt-0.5">
                {lastSyncTime ? `上次同步：${lastSyncTime}` : '尚未同步'}
              </p>
            </div>
            <button
              onClick={() => handlePullSync(false)}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-700 transition-colors border border-stone-700 disabled:opacity-50"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              {syncing ? '同步中…' : '同步'}
            </button>
          </div>

          {/* Import external events */}
          <button
            onClick={() => handlePullSync(true)}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 px-3 py-2 rounded-lg hover:bg-stone-800 transition-colors border border-stone-700/50 disabled:opacity-50"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            同步并导入 Google 日历中的外部事件
          </button>

          {/* Sync result */}
          {syncResult && (
            <div className="p-2 bg-stone-800/50 rounded-lg text-xs text-stone-400 space-y-0.5">
              <div className="flex items-center gap-1.5 text-green-400 font-medium mb-1">
                <Check size={12} /> 同步完成
              </div>
              <div>拉取事件：{syncResult.total} 个</div>
              {syncResult.gcalDeleted > 0 && (
                <div className="text-yellow-400">已在 Google 删除：{syncResult.gcalDeleted} 个（本地日历关联已解除）</div>
              )}
              {syncResult.imported > 0 && (
                <div className="text-blue-400">新导入：{syncResult.imported} 个任务</div>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle size={12} className="flex-shrink-0" /> {error}
            </p>
          )}
        </div>

        {/* Edit credentials */}
        <button
          onClick={() => setShowCredForm(true)}
          className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
        >
          修改 OAuth 凭据
        </button>
      </div>
    )
  }

  // ── Not connected (has credentials) ─────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Waiting for browser */}
      {waitingBrowser && (
        <div className="flex items-start gap-2.5 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <Loader2 size={14} className="text-orange-400 animate-spin flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <div className="text-orange-300 font-medium mb-0.5">浏览器已打开 Google 授权页面</div>
            <div className="text-orange-400/70">请在浏览器中登录并点击"允许"，完成后将自动返回此处。</div>
          </div>
        </div>
      )}

      {/* Connect button */}
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-gray-700 font-medium text-sm rounded-xl border border-gray-200 transition-colors shadow-sm"
      >
        {loading ? <Loader2 size={16} className="animate-spin text-gray-400" /> : <GoogleIcon />}
        {loading ? (waitingBrowser ? '等待授权完成…' : '连接中…') : '使用 Google 账户连接'}
      </button>

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0" /> {error}
        </p>
      )}

      {!waitingBrowser && !error && (
        <p className="text-xs text-stone-600 text-center">点击后浏览器将自动打开授权页面，授权后自动返回</p>
      )}

      <button
        onClick={() => setShowCredForm(true)}
        className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
      >
        修改 OAuth 凭据
      </button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

export function CalendarSyncBadge({ eventLink }) {
  return (
    <a
      href={eventLink || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => !eventLink && e.preventDefault()}
      title="在 Google Calendar 中查看"
      className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7z"/>
      </svg>
    </a>
  )
}
