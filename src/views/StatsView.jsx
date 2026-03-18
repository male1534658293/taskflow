import React, { useMemo } from 'react'
import { Flame, TrendingUp, Star, CheckCircle } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { levelFromKarma, isToday, priorityColor } from '../utils/helpers.js'
function BarChart({ data }) {
  const maxVal = Math.max(...data.map(d => d.completed), 1)
  return (
    <div className="flex items-end gap-2 h-28">
      {data.map((d, i) => {
        const height = Math.max((d.completed / maxVal) * 100, 4)
        const isToday = i === data.length - 1
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-stone-500">{d.completed}</span>
            <div
              className={`w-full rounded-t-md transition-all ${isToday ? 'bg-orange-500' : 'bg-stone-700'}`}
              style={{ height: `${height}%` }}
            />
            <span className={`text-xs ${isToday ? 'text-orange-400 font-medium' : 'text-stone-500'}`}>
              {d.day}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function StatsView() {
  const { state } = useApp()
  const { todos, user } = state

  const weeklyStats = useMemo(() => {
    const days = []
    const dayNames = ['周日','周一','周二','周三','周四','周五','周六']
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const completed = todos.filter(t =>
        t.status === 'completed' &&
        t.completedAt &&
        t.completedAt.split('T')[0] === dateStr
      ).length
      days.push({
        day: i === 0 ? '今天' : dayNames[d.getDay()],
        completed,
        date: dateStr
      })
    }
    return days
  }, [todos])

  const level = levelFromKarma(user.karma)
  const levelProgress = Math.min(((user.karma - (level.current - user.karma + user.karma)) / (level.next - 0)) * 100, 100)
  const progressPercent = level.next > user.karma
    ? Math.round(((user.karma - (level.next - (level.next - 0))) / level.next) * 100)
    : 100

  const completedToday = todos.filter(t => t.status === 'completed' && isToday(t.dueDate)).length
  const completedThisWeek = weeklyStats.reduce((s, d) => s + d.completed, 0)
  const totalCompleted = todos.filter(t => t.status === 'completed').length

  const priorityCounts = ['P1', 'P2', 'P3', 'P4'].map(p => ({
    label: p,
    total: todos.filter(t => t.priority === p).length,
    done: todos.filter(t => t.priority === p && t.status === 'completed').length,
  }))
  const maxPCount = Math.max(...priorityCounts.map(p => p.total), 1)

  const tagStats = (() => {
    const map = {}
    todos.forEach(t => {
      t.tags?.forEach(tag => {
        if (!map[tag]) map[tag] = { total: 0, done: 0 }
        map[tag].total++
        if (t.status === 'completed') map[tag].done++
      })
    })
    return Object.entries(map)
      .map(([tag, s]) => ({ tag, ...s }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  })()
  const maxTagCount = Math.max(...tagStats.map(t => t.total), 1)

  const completedTodayTasks = todos
    .filter(t => t.status === 'completed' && isToday(t.dueDate))
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-stone-100">统计</h1>
        <p className="text-sm text-stone-500 mt-0.5">你的生产力全景</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* Karma */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Star size={16} className="text-orange-400" />
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">
              {level.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-stone-100">{user.karma}</div>
          <div className="text-xs text-stone-500 mb-2">Karma 积分</div>
          {level.next > user.karma && (
            <>
              <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full"
                  style={{ width: `${(user.karma / level.next) * 100}%` }}
                />
              </div>
              <p className="text-xs text-stone-600 mt-1">{level.next - user.karma} 分到 {level.nextLabel}</p>
            </>
          )}
        </div>

        {/* Today */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-xs text-stone-500">今天</span>
          </div>
          <div className="text-2xl font-bold text-stone-100">{completedToday}</div>
          <div className="text-xs text-stone-500">已完成任务</div>
        </div>

        {/* Streak */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Flame size={16} className="text-orange-500" />
            <span className="text-xs text-stone-500">最长 {user.longestStreak}天</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">{user.streak}</div>
          <div className="text-xs text-stone-500">连续天数 🔥</div>
        </div>

        {/* Weekly */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp size={16} className="text-amber-400" />
            <span className="text-xs text-stone-500">本周</span>
          </div>
          <div className="text-2xl font-bold text-stone-100">{completedThisWeek}</div>
          <div className="text-xs text-stone-500">完成任务</div>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-stone-300 mb-4">📅 本周完成趋势</h3>
        <BarChart data={weeklyStats} />
      </div>

      {/* Priority breakdown */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-stone-300 mb-4">🎯 优先级分布</h3>
        <div className="space-y-3">
          {priorityCounts.map(p => (
            <div key={p.label} className="flex items-center gap-3">
              <span className={`text-xs font-medium w-6 ${priorityColor(p.label)}`}>{p.label}</span>
              <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    p.label === 'P1' ? 'bg-red-500' :
                    p.label === 'P2' ? 'bg-orange-500' :
                    p.label === 'P3' ? 'bg-amber-500' : 'bg-stone-600'
                  }`}
                  style={{ width: `${(p.total / maxPCount) * 100}%` }}
                />
              </div>
              <div className="text-right w-16">
                <span className="text-xs text-stone-400">{p.done}/{p.total}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tag breakdown */}
      {tagStats.length > 0 && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-stone-300 mb-4">🏷️ 标签热力图</h3>
          <div className="space-y-2.5">
            {tagStats.map(t => (
              <div key={t.tag} className="flex items-center gap-3">
                <span className="text-xs text-stone-400 w-12 truncate">#{t.tag}</span>
                <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500/70 rounded-full"
                    style={{ width: `${(t.total / maxTagCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-stone-500 w-10 text-right">{t.done}/{t.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's timeline */}
      {completedTodayTasks.length > 0 && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-stone-300 mb-4">⏱️ 今日完成时间线</h3>
          <div className="space-y-2">
            {completedTodayTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3">
                <span className="text-xs text-stone-500 w-12 flex-shrink-0 font-mono">
                  {task.completedAt ? new Date(task.completedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm text-stone-400 line-through">{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
