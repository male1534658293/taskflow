import React from 'react'
import { Zap, Calendar, Inbox, Layout, BarChart2, Settings, Flame, Plus, CalendarDays, BarChart, Trophy, PanelTopOpen, BookOpen, Tag } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { isToday } from '../utils/helpers.js'
import { isDueToday } from '../utils/srs.js'

export default function Sidebar() {
  const { state, dispatch } = useApp()
  const { currentView, todos, user, sync, learning } = state

  const todayIncomplete = todos.filter(
    t => isToday(t.dueDate) && t.status !== 'completed'
  ).length

  const totalIncomplete = todos.filter(t => t.status !== 'completed').length
  const dueReviews = learning.cards.filter(isDueToday).length

  const navItems = [
    { id: 'today', icon: Calendar, label: '今天', badge: todayIncomplete },
    { id: 'inbox', icon: Inbox, label: '收件箱', badge: totalIncomplete },
    { id: 'kanban', icon: Layout, label: '看板', badge: null },
    { id: 'calendar', icon: CalendarDays, label: '日历', badge: null },
    { id: 'gantt', icon: BarChart, label: '甘特图', badge: null },
    { id: 'tags', icon: Tag, label: '标签汇总', badge: null },
    { id: 'learning', icon: BookOpen, label: '学习记录', badge: dueReviews || null },
    { id: 'stats', icon: BarChart2, label: '统计', badge: null },
    { id: 'achievements', icon: Trophy, label: '成就', badge: null },
    { id: 'settings', icon: Settings, label: '设置', badge: null },
  ]

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-screen bg-stone-900 z-10">
      {/* macOS traffic light spacer — only in Electron */}
      {isElectron && <div className="h-8 flex-shrink-0" style={{ WebkitAppRegion: 'drag' }} />}

      {/* Logo */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-bold text-lg text-stone-100">TaskFlow</span>
      </div>

      {/* User info */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {(user.name || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-stone-100">{user.name}</div>
            <div className="text-xs text-orange-400 font-medium">{user.karma} Karma</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const isActive = currentView === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: item.id })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-orange-600 text-white' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'
              }`}
            >
              <Icon size={16} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-stone-700 text-stone-300'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 space-y-2">
        {/* Streak */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Flame size={14} className="text-orange-500" />
          <span className="text-xs text-stone-400">
            🔥 <span className="text-orange-400 font-medium">{user.streak}天</span> 连续
          </span>
        </div>

        {/* Sync status */}
        <div className="flex items-center gap-2 px-2 py-1">
          {sync.status === 'synced' ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs text-stone-500">已同步</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
              <span className="text-xs text-stone-500">同步中...</span>
            </>
          )}
        </div>

        {/* New task button */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_NLP_INPUT' })}
          className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
        >
          <Plus size={15} />
          新建任务
        </button>

        {/* Float window button (Electron only) */}
        {isElectron && (
          <button
            onClick={() => window.electronAPI.openFloatWindow()}
            className="w-full flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium py-1.5 px-3 rounded-lg transition-colors border border-stone-700"
          >
            <PanelTopOpen size={13} />
            打开浮窗 ⌘⇧T
          </button>
        )}
      </div>
    </aside>
  )
}
