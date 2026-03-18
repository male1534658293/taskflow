import React from 'react'
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

  useKeyboardShortcuts()

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
