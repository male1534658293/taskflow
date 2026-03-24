import React, { useState, useRef, useEffect } from 'react'
import { X, Zap, Calendar, Check, Loader2, ExternalLink, AlertCircle } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { parseNLP, priorityColor, priorityDot } from '../utils/helpers.js'
import { isGoogleConnected, createCalendarEvent } from '../utils/googleCalendar.js'

const RECURRENCE_LABEL = { daily: '每天', weekly: '每周', weekdays: '工作日', monthly: '每月', yearly: '每年' }

export default function NLPInput() {
  const { dispatch } = useApp()
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState(null)
  const [syncToCalendar, setSyncToCalendar] = useState(isGoogleConnected())
  const [calSyncState, setCalSyncState] = useState('idle') // idle | syncing | success | error
  const [calEventLink, setCalEventLink] = useState(null)
  const [calError, setCalError] = useState(null)
  const inputRef = useRef(null)
  const googleConnected = isGoogleConnected()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (input.trim()) setParsed(parseNLP(input))
    else setParsed(null)
  }, [input])

  async function handleCreate() {
    if (!input.trim()) return
    const result = parsed || parseNLP(input)

    // 先创建任务（本地）
    dispatch({ type: 'ADD_TODO', payload: result })

    // 同步到 Google Calendar
    if (syncToCalendar && googleConnected) {
      setCalSyncState('syncing')
      try {
        const todoForSync = {
          id: Date.now().toString(),
          ...result,
        }
        const res = await createCalendarEvent(todoForSync)
        if (res.success) {
          setCalSyncState('success')
          setCalEventLink(res.eventLink)
          // 短暂显示成功后关闭
          setTimeout(() => dispatch({ type: 'TOGGLE_NLP_INPUT' }), 1800)
        } else {
          setCalSyncState('error')
          setCalError(res.error === 'token_expired' ? '授权已过期，请在设置中重新连接' : res.error)
          setTimeout(() => dispatch({ type: 'TOGGLE_NLP_INPUT' }), 2500)
        }
      } catch (e) {
        setCalSyncState('error')
        setCalError(e.message)
        setTimeout(() => dispatch({ type: 'TOGGLE_NLP_INPUT' }), 2000)
      }
    } else {
      dispatch({ type: 'TOGGLE_NLP_INPUT' })
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate() }
    if (e.key === 'Escape') dispatch({ type: 'TOGGLE_NLP_INPUT' })
  }

  const isCreating = calSyncState === 'syncing'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isCreating && dispatch({ type: 'TOGGLE_NLP_INPUT' })} />

      <div className="relative w-full max-w-xl mx-4 bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl animate-fadeIn overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-orange-400" />
            <h3 className="font-semibold text-stone-100">新建任务</h3>
          </div>
          <button onClick={() => !isCreating && dispatch({ type: 'TOGGLE_NLP_INPUT' })} className="text-stone-500 hover:text-stone-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {/* Input */}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isCreating}
            placeholder="九点三十 开会 · 明天下午两点 p1 @工作 · next monday 3pm"
            className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder-stone-500 text-sm focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-50"
          />

          {/* NLP Preview */}
          {parsed && input.trim() && (
            <div className="mt-3 p-3 bg-stone-800/50 border border-stone-700 rounded-xl animate-fadeIn">
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wide mb-2">解析预览</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <span className="text-stone-400">标题</span>
                <span className="text-stone-100 font-medium">{parsed.title || '新任务'}</span>
                <span className="text-stone-400">优先级</span>
                <span className={`font-medium ${priorityColor(parsed.priority)}`}>{priorityDot(parsed.priority)} {parsed.priority}</span>
                {parsed.tags?.length > 0 && (<><span className="text-stone-400">标签</span><span className="text-stone-300">{parsed.tags.map(t => `#${t}`).join(' ')}</span></>)}
                {parsed.dueDate && (<><span className="text-stone-400">截止</span><span className="text-stone-300">📅 {parsed.dueDate}{parsed.dueTime ? ` ⏰ ${parsed.dueTime}` : ''}</span></>)}
                {parsed.recurrence && (<><span className="text-stone-400">重复</span><span className="text-stone-300">🔁 {RECURRENCE_LABEL[parsed.recurrence] || parsed.recurrence}</span></>)}
              </div>
            </div>
          )}

          {/* Google Calendar Sync Toggle */}
          <div className={`mt-3 rounded-xl border transition-colors ${syncToCalendar && googleConnected ? 'border-green-500/40 bg-green-500/5' : 'border-stone-700 bg-stone-800/30'}`}>
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  {calSyncState === 'syncing' ? (
                    <Loader2 size={14} className="text-green-400 animate-spin" />
                  ) : calSyncState === 'success' ? (
                    <Check size={14} className="text-green-400" />
                  ) : calSyncState === 'error' ? (
                    <AlertCircle size={14} className="text-red-400" />
                  ) : (
                    <Calendar size={14} className={googleConnected ? 'text-green-400' : 'text-stone-500'} />
                  )}
                </div>
                <div>
                  <span className="text-xs font-medium text-stone-300">同步到 Google Calendar</span>
                  <p className="text-xs text-stone-500 leading-none mt-0.5">
                    {calSyncState === 'syncing' ? '正在创建日历事件...' :
                     calSyncState === 'success' ? '已创建日历事件 ✓' :
                     calSyncState === 'error' ? calError :
                     googleConnected ? '将在 Google Calendar 创建同名事件' : '请先在设置中连接 Google 账户'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {calSyncState === 'success' && calEventLink && (
                  <a href={calEventLink} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                    查看 <ExternalLink size={11} />
                  </a>
                )}
                {googleConnected && calSyncState === 'idle' && (
                  <button
                    onClick={() => setSyncToCalendar(!syncToCalendar)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${syncToCalendar ? 'bg-green-500' : 'bg-stone-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${syncToCalendar ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                )}
              </div>
            </div>

            {syncToCalendar && googleConnected && parsed?.dueDate && calSyncState === 'idle' && (
              <div className="px-3 pb-2.5 flex items-center gap-3 text-xs text-stone-500 border-t border-stone-700/50 pt-2">
                <span>📅 {parsed.dueDate}{parsed.dueTime ? ` ${parsed.dueTime}` : ' 09:00'}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  parsed.priority === 'P1' ? 'bg-red-500/10 text-red-400' :
                  parsed.priority === 'P2' ? 'bg-orange-500/10 text-orange-400' :
                  'bg-stone-700 text-stone-400'}`}>
                  {parsed.priority}
                </span>
                {parsed.recurrence && <span>🔁 {RECURRENCE_LABEL[parsed.recurrence]}</span>}
              </div>
            )}
          </div>

          {/* Recurrence quick-pick */}
          <div className="mt-3">
            <p className="text-xs text-stone-600 mb-1.5 px-1">重复频率</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { value: null,       label: '不重复',  kw: null },
                { value: 'daily',    label: '每天',    kw: 'every day' },
                { value: 'weekdays', label: '工作日',  kw: 'every weekday' },
                { value: 'weekly',   label: '每周',    kw: 'every week' },
                { value: 'monthly',  label: '每月',    kw: 'monthly' },
              ].map(opt => {
                const active = parsed?.recurrence === opt.value
                return (
                  <button
                    key={String(opt.value)}
                    onClick={() => {
                      // 先把旧的重复关键词从输入中去掉，再追加新的
                      let base = input
                        .replace(/everyday|every\s+day|每天|daily/gi, '')
                        .replace(/every\s+weekday|工作日/gi, '')
                        .replace(/every\s+week|每周|weekly/gi, '')
                        .replace(/monthly|每月/gi, '')
                        .replace(/\s+/g, ' ').trim()
                      if (opt.kw) base = (base + ' ' + opt.kw).trim()
                      setInput(base)
                    }}
                    className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                      active
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                        : 'bg-stone-800 text-stone-500 border-stone-700 hover:border-stone-500 hover:text-stone-300'
                    }`}
                  >
                    {opt.value ? '🔁 ' : ''}{opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Syntax hints */}
          <div className="mt-2 px-1">
            <div className="flex flex-wrap gap-1">
              {['p1-p4', '九点三十', '下午两点半', '明天', '后天', 'next monday', '@tag', '#project'].map(hint => (
                <span key={hint} className="text-xs bg-stone-800 text-stone-500 px-2 py-0.5 rounded-full">{hint}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-stone-800">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_NLP_INPUT' })}
            disabled={isCreating}
            className="px-4 py-2 text-sm text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-40"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!input.trim() || isCreating}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isCreating ? <Loader2 size={14} className="animate-spin" /> : null}
            {isCreating ? '创建中...' : syncToCalendar && googleConnected ? '创建并同步 ↵' : '创建任务 ↵'}
          </button>
        </div>
      </div>
    </div>
  )
}
