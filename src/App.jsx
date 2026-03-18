import React, { useState, useEffect } from 'react'
import { AppProvider } from './store/AppContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import TodayView from './views/TodayView.jsx'
import InboxView from './views/InboxView.jsx'
import KanbanView from './views/KanbanView.jsx'
import CalendarView from './views/CalendarView.jsx'
import GanttView from './views/GanttView.jsx'
import StatsView from './views/StatsView.jsx'
import SettingsView from './views/SettingsView.jsx'
import AchievementsView from './views/AchievementsView.jsx'
import TaskDetailModal from './components/TaskDetailModal.jsx'
import NLPInput from './components/NLPInput.jsx'
import FocusSelectionModal from './components/FocusSelectionModal.jsx'
import Celebration from './components/Celebration.jsx'
import FloatingWidget from './components/FloatingWidget.jsx'
import { useApp } from './store/AppContext.jsx'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'

// Detect if running as float window (Electron opens with #float hash)
const isFloatMode = typeof window !== 'undefined' && window.location.hash === '#float'

function Layout() {
  const { state } = useApp()
  const { currentView, modals } = state
  const [updateInfo, setUpdateInfo] = useState(null)
  const [updateStatus, setUpdateStatus] = useState(null)
  const [downloadPct, setDownloadPct] = useState(0)

  useKeyboardShortcuts()

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.onUpdateAvailable?.((_, info) => setUpdateInfo(info))
    window.electronAPI.onUpdateDownloading?.(() => setUpdateStatus('downloading'))
    window.electronAPI.onUpdateProgress?.((_, pct) => setDownloadPct(pct))
  }, [])

  if (isFloatMode) {
    return <FloatingWidget />
  }

  const views = {
    today: TodayView,
    inbox: InboxView,
    kanban: KanbanView,
    calendar: CalendarView,
    gantt: GanttView,
    stats: StatsView,
    settings: SettingsView,
    achievements: AchievementsView,
  }

  const CurrentView = views[currentView] || TodayView

  return (
    <div className="flex h-screen overflow-hidden bg-stone-950 text-stone-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <CurrentView />
      </main>

      {modals.taskDetail && <TaskDetailModal task={modals.taskDetail} />}
      {modals.nlpInput && <NLPInput />}
      {modals.focusSelection && <FocusSelectionModal />}
      {modals.celebration && <Celebration />}

      {/* 更新通知浮窗 */}
      {updateInfo && (
        <div className="fixed bottom-5 right-5 z-50 w-72 bg-stone-800 border border-stone-700 rounded-xl shadow-2xl p-4 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">🔄</span>
            <span className="text-sm font-semibold text-stone-100">发现新版本 v{updateInfo.version}</span>
          </div>
          {updateInfo.releaseNotes ? (
            <p className="text-xs text-stone-400 mb-3 line-clamp-2">{updateInfo.releaseNotes}</p>
          ) : (
            <p className="text-xs text-stone-500 mb-3">点击立即更新后台下载，完成后提示重启安装。</p>
          )}
          {updateStatus === 'downloading' ? (
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-stone-400">下载中…</span>
                <span className="text-stone-400">{downloadPct}%</span>
              </div>
              <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all duration-300" style={{ width: `${downloadPct}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.electronAPI?.downloadUpdate?.()
                  setUpdateStatus('downloading')
                }}
                className="flex-1 text-xs bg-orange-600 hover:bg-orange-500 text-white py-1.5 rounded-lg transition-colors font-medium"
              >
                立即更新
              </button>
              <button
                onClick={() => setUpdateInfo(null)}
                className="text-xs text-stone-400 hover:text-stone-200 px-3 py-1.5 rounded-lg hover:bg-stone-700 transition-colors"
              >
                稍后
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  )
}
