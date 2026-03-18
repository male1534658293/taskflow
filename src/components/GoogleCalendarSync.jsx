import React, { useState } from 'react'
import { Check, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import {
  requestGoogleAccess,
  revokeGoogleAccess,
  isGoogleConnected,
  getGoogleEmail,
  hasCredentials,
} from '../utils/googleCalendar.js'

export default function GoogleCalendarSync({ onConnectionChange }) {
  const [connected, setConnected] = useState(isGoogleConnected())
  const [email, setEmail] = useState(getGoogleEmail())
  const [loading, setLoading] = useState(false)
  const [waitingBrowser, setWaitingBrowser] = useState(false)
  const [error, setError] = useState(null)
  const [showGuide, setShowGuide] = useState(true)

  const isDemo = !hasCredentials()

  async function handleConnect() {
    setLoading(true)
    setError(null)

    if (!isDemo) setWaitingBrowser(true)

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
    setError(null)
    onConnectionChange?.(false, '')
  }

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <GoogleIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Check size={13} className="text-green-400" />
              <span className="text-sm font-medium text-stone-200">已连接 Google Calendar</span>
              {isDemo && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">演示</span>
              )}
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
        <div className="grid grid-cols-2 gap-2 text-xs text-stone-400">
          {['创建任务时自动同步', '颜色按优先级标注', '支持循环任务规则', '30 分钟前弹窗提醒'].map(f => (
            <div key={f} className="flex items-center gap-1.5 p-2 bg-stone-800/50 rounded-lg">
              <Check size={12} className="text-green-400" /> {f}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 操作流程引导 */}
      <div className="border border-stone-700/60 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowGuide(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-stone-800/50 hover:bg-stone-700/50 transition-colors text-left"
        >
          <span className="text-xs font-medium text-stone-300">同步前准备（点击展开）</span>
          {showGuide ? <ChevronUp size={13} className="text-stone-500" /> : <ChevronDown size={13} className="text-stone-500" />}
        </button>

        {showGuide && (
          <div className="px-3 pb-3 pt-2 space-y-2.5 bg-stone-800/20">
            {/* 步骤一：飞书 */}
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">1</div>
              <div>
                <p className="text-xs font-medium text-stone-300 mb-0.5">飞书开启 Google 日历同步</p>
                <p className="text-xs text-stone-500 leading-relaxed">
                  飞书 → 设置 → 日历 → 第三方日历同步 → 选择 <span className="text-stone-300">Google 日历</span> → 开启
                </p>
              </div>
            </div>

            <div className="h-px bg-stone-700/50" />

            {/* 步骤二：连接 Google */}
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center mt-0.5">2</div>
              <div>
                <p className="text-xs font-medium text-stone-300 mb-0.5">在此连接 Google 账户</p>
                <p className="text-xs text-stone-500 leading-relaxed">
                  点击下方按钮 → 浏览器打开授权页面 → 用 Google 账号登录并点击"允许" → 自动返回应用
                </p>
              </div>
            </div>

            <div className="h-px bg-stone-700/50" />

            {/* 步骤三：效果 */}
            <div className="flex gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold flex items-center justify-center mt-0.5">3</div>
              <div>
                <p className="text-xs font-medium text-stone-300 mb-0.5">完成</p>
                <p className="text-xs text-stone-500 leading-relaxed">
                  TaskFlow 中创建的任务自动同步到 Google Calendar，飞书日历中即可看到
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Browser waiting state */}
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
        {loading
          ? (waitingBrowser ? '等待授权完成…' : '连接中…')
          : '使用 Google 账户连接'}
      </button>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0" /> {error}
        </p>
      )}

      {/* Hint */}
      {!waitingBrowser && !error && (
        <p className="text-xs text-stone-600 text-center">
          {isDemo ? '未配置凭据，将以演示模式运行' : '点击后浏览器将自动打开授权页面，授权后自动返回'}
        </p>
      )}
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

export function CalendarSyncBadge({ eventLink, demo }) {
  return (
    <a
      href={eventLink || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => !eventLink && e.preventDefault()}
      title={demo ? '已同步到演示日历' : '在 Google Calendar 中查看'}
      className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7z"/>
      </svg>
    </a>
  )
}
