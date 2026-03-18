import React, { useEffect, useRef } from 'react'
import { useApp } from '../store/AppContext.jsx'

const COLORS = ['#6366f1', '#f97316', '#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6']

function createConfetti() {
  return Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2.5 + Math.random() * 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    shape: Math.random() > 0.5 ? 'circle' : 'rect',
    rotate: Math.random() * 360,
  }))
}

export default function Celebration() {
  const { state, dispatch } = useApp()
  const timerRef = useRef(null)
  const confetti = useRef(createConfetti()).current

  const focusCount = state.focus.selectedIds.length
  const karmaGained = state.focus.selectedIds.reduce((sum, id) => {
    const task = state.todos.find(t => t.id === id)
    return sum + (task ? ({ P1: 40, P2: 30, P3: 20, P4: 10 }[task.priority] || 10) : 0)
  }, 0)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      dispatch({ type: 'CLOSE_CELEBRATION' })
    }, 4000)
    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={() => dispatch({ type: 'CLOSE_CELEBRATION' })}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {confetti.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: '-20px',
            width: p.size,
            height: p.shape === 'rect' ? p.size * 0.4 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}

      <div className="relative text-center animate-celebrate z-10 px-4">
        <div className="text-6xl mb-4">🎉</div>

        <div className="bg-stone-900 border border-stone-700 rounded-3xl px-10 py-8 shadow-2xl max-w-sm mx-auto">
          <h2 className="text-2xl font-bold text-white mb-1">Today Zero!</h2>
          <p className="text-stone-300 text-base mb-5">你已完成所有 {focusCount} 个焦点任务！</p>

          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">+{karmaGained}</div>
              <div className="text-xs text-stone-500 mt-0.5">Karma 加成</div>
            </div>
            <div className="w-px h-10 bg-stone-700" />
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-400">🔥</div>
              <div className="text-xs text-stone-500 mt-0.5">连续 {state.user.streak} 天</div>
            </div>
          </div>

          <div className="w-full bg-stone-800 rounded-full h-1.5 mb-5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-purple-500 rounded-full progress-bar"
              style={{ width: `${Math.min((state.user.karma / 1000) * 100, 100)}%` }}
            />
          </div>

          <p className="text-xs text-stone-500">
            总 Karma: {state.user.karma} pts · 点击任意处关闭
          </p>
        </div>

        <p className="mt-4 text-stone-500 text-sm">✨ 3秒后自动关闭</p>
      </div>
    </div>
  )
}
