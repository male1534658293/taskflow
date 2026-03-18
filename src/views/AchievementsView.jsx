import React from 'react'
import { useApp } from '../store/AppContext.jsx'

const ACHIEVEMENTS = [
  { id: 'first_task', icon: '⭐', label: '第一步', desc: '完成第一个任务', condition: (todos) => todos.filter(t => t.status === 'completed').length >= 1, total: 1, getValue: (todos) => todos.filter(t => t.status === 'completed').length },
  { id: 'complete_10', icon: '🎯', label: '初级猎人', desc: '完成10个任务', condition: (todos) => todos.filter(t => t.status === 'completed').length >= 10, total: 10, getValue: (todos) => todos.filter(t => t.status === 'completed').length },
  { id: 'complete_50', icon: '🏆', label: '任务达人', desc: '完成50个任务', condition: (todos) => todos.filter(t => t.status === 'completed').length >= 50, total: 50, getValue: (todos) => todos.filter(t => t.status === 'completed').length },
  { id: 'complete_100', icon: '👑', label: '传奇大师', desc: '完成100个任务', condition: (todos) => todos.filter(t => t.status === 'completed').length >= 100, total: 100, getValue: (todos) => todos.filter(t => t.status === 'completed').length },
  { id: 'p1_complete', icon: '🔥', label: '急先锋', desc: '完成一个P1任务', condition: (todos) => todos.filter(t => t.status === 'completed' && t.priority === 'P1').length >= 1, total: 1, getValue: (todos) => todos.filter(t => t.status === 'completed' && t.priority === 'P1').length },
  { id: 'p1_5', icon: '⚡', label: '优先大师', desc: '完成5个P1任务', condition: (todos) => todos.filter(t => t.status === 'completed' && t.priority === 'P1').length >= 5, total: 5, getValue: (todos) => todos.filter(t => t.status === 'completed' && t.priority === 'P1').length },
  { id: 'streak_3', icon: '🌱', label: '习惯萌芽', desc: '保持3天连续完成', condition: (todos, user) => user.streak >= 3, total: 3, getValue: (todos, user) => user.streak },
  { id: 'streak_7', icon: '🌿', label: '坚持一周', desc: '连续完成7天', condition: (todos, user) => user.streak >= 7, total: 7, getValue: (todos, user) => user.streak },
  { id: 'streak_30', icon: '🌳', label: '月度坚持', desc: '连续完成30天', condition: (todos, user) => user.streak >= 30, total: 30, getValue: (todos, user) => user.streak },
  { id: 'karma_200', icon: '💎', label: 'Karma新星', desc: '积累200 Karma', condition: (todos, user) => user.karma >= 200, total: 200, getValue: (todos, user) => user.karma },
  { id: 'karma_500', icon: '🏅', label: 'Karma猎手', desc: '积累500 Karma', condition: (todos, user) => user.karma >= 500, total: 500, getValue: (todos, user) => user.karma },
  { id: 'karma_1000', icon: '🎖️', label: 'Karma大师', desc: '积累1000 Karma', condition: (todos, user) => user.karma >= 1000, total: 1000, getValue: (todos, user) => user.karma },
  { id: 'tags_master', icon: '🏷️', label: '分类达人', desc: '使用5个不同标签', condition: (todos) => new Set(todos.flatMap(t => t.tags || [])).size >= 5, total: 5, getValue: (todos) => new Set(todos.flatMap(t => t.tags || [])).size },
  { id: 'subtask_master', icon: '📋', label: '细节控', desc: '完成10个子任务', condition: (todos) => todos.flatMap(t => t.subtasks || []).filter(s => s.done).length >= 10, total: 10, getValue: (todos) => todos.flatMap(t => t.subtasks || []).filter(s => s.done).length },
  { id: 'night_owl', icon: '🦉', label: '夜猫子', desc: '晚上10点后完成任务', condition: (todos) => todos.some(t => t.completedAt && new Date(t.completedAt).getHours() >= 22), total: null, getValue: () => null },
  { id: 'early_bird', icon: '🐦', label: '早起鸟', desc: '早上6点前完成任务', condition: (todos) => todos.some(t => t.completedAt && new Date(t.completedAt).getHours() < 6), total: null, getValue: () => null },
]

export default function AchievementsView() {
  const { state } = useApp()
  const { todos, user } = state

  const unlockedCount = ACHIEVEMENTS.filter(a => a.condition(todos, user)).length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-stone-100">成就</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          已解锁 <span className="text-yellow-400 font-semibold">{unlockedCount}</span> / {ACHIEVEMENTS.length} 个成就
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6 bg-stone-900 border border-stone-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-stone-400">总进度</span>
          <span className="text-sm font-medium text-stone-300">{Math.round((unlockedCount / ACHIEVEMENTS.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ACHIEVEMENTS.map(achievement => {
          const unlocked = achievement.condition(todos, user)
          const currentValue = achievement.getValue(todos, user)
          const hasProgress = achievement.total !== null && currentValue !== null
          const progress = hasProgress ? Math.min(currentValue, achievement.total) : 0
          const progressPct = hasProgress ? (progress / achievement.total) * 100 : 0

          return (
            <div
              key={achievement.id}
              className={`relative rounded-2xl border p-4 flex flex-col gap-2 transition-all ${
                unlocked
                  ? 'border-yellow-500/40 bg-yellow-500/5 shadow-[0_0_20px_rgba(234,179,8,0.1)]'
                  : 'border-stone-700 bg-stone-900 opacity-60'
              }`}
            >
              {/* Unlocked badge */}
              {unlocked && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-black font-bold">✓</span>
                </div>
              )}

              {/* Icon */}
              <div className={`text-3xl ${unlocked ? '' : 'grayscale'}`}>
                {achievement.icon}
              </div>

              {/* Label & desc */}
              <div>
                <div className={`text-sm font-semibold ${unlocked ? 'text-stone-100' : 'text-stone-400'}`}>
                  {achievement.label}
                </div>
                <div className="text-xs text-stone-500 mt-0.5 leading-tight">
                  {achievement.desc}
                </div>
              </div>

              {/* Progress bar for count-based achievements */}
              {hasProgress && !unlocked && (
                <div className="mt-1">
                  <div className="flex justify-between text-xs text-stone-600 mb-1">
                    <span>{progress}</span>
                    <span>{achievement.total}</span>
                  </div>
                  <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {hasProgress && unlocked && (
                <div className="mt-1">
                  <div className="h-1 bg-yellow-500/30 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-yellow-500 rounded-full" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
