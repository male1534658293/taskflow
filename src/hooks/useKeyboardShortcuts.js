import { useEffect } from 'react'
import { useApp } from '../store/AppContext.jsx'

export function useKeyboardShortcuts() {
  const { state, dispatch } = useApp()

  useEffect(() => {
    function handleKeyDown(e) {
      // Don't trigger if user is typing in an input/textarea
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // Don't trigger if any modal is open
      const { modals } = state
      const anyModalOpen = modals.taskDetail || modals.nlpInput || modals.focusSelection

      switch (e.key) {
        case 'n':
        case 'N':
          if (!anyModalOpen) {
            e.preventDefault()
            dispatch({ type: 'TOGGLE_NLP_INPUT' })
          }
          break
        case '1': dispatch({ type: 'SET_VIEW', payload: 'today' }); break
        case '2': dispatch({ type: 'SET_VIEW', payload: 'inbox' }); break
        case '3': dispatch({ type: 'SET_VIEW', payload: 'kanban' }); break
        case '4': dispatch({ type: 'SET_VIEW', payload: 'calendar' }); break
        case '5': dispatch({ type: 'SET_VIEW', payload: 'stats' }); break
        case 'Escape':
          if (modals.taskDetail) dispatch({ type: 'CLOSE_TASK_DETAIL' })
          else if (modals.nlpInput) dispatch({ type: 'TOGGLE_NLP_INPUT' })
          else if (modals.focusSelection) dispatch({ type: 'CLOSE_FOCUS_SELECTION' })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.modals, dispatch])
}
