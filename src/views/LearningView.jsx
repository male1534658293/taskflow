import React, { useState, useMemo } from 'react'
import { Plus, BookOpen, RotateCcw, ChevronLeft, Trash2, Flame, X, Download, EyeOff, Pause, Play, Layers } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { isDueToday, getMasteryLabel, getMasteryColor, hasCloze, parseCloze } from '../utils/srs.js'

// ─── 填空题渲染 ───────────────────────────────────────────────────────────────
function ClozeText({ text, revealed }) {
  const parts = parseCloze(text)
  return (
    <span>
      {parts.map((p, i) =>
        p.type === 'cloze' ? (
          <span key={i} className={`inline-block px-1 rounded font-medium ${
            revealed
              ? 'text-orange-300 bg-orange-500/20 border border-orange-500/40'
              : 'text-transparent bg-stone-600 border border-stone-500 select-none'
          }`}>
            {revealed ? p.value : p.value.replace(/./g, '▪')}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </span>
  )
}

// ─── 复习热力图 ───────────────────────────────────────────────────────────────
function ReviewHeatmap({ reviewHistory }) {
  const cells = []
  for (let i = 90; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    cells.push({ dateStr, count: (reviewHistory || {})[dateStr] || 0 })
  }
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const getColor = (count) => {
    if (count === 0) return 'bg-stone-800'
    if (count <= 2) return 'bg-green-900/80'
    if (count <= 6) return 'bg-green-700'
    return 'bg-green-500'
  }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">复习热力图（近13周）</span>
        <div className="flex items-center gap-1 text-xs text-stone-600">
          少
          {['bg-stone-800', 'bg-green-900/80', 'bg-green-700', 'bg-green-500'].map((c, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c}`} />
          ))}
          多
        </div>
      </div>
      <div className="flex gap-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map(({ dateStr, count }) => (
              <div
                key={dateStr}
                title={`${dateStr}：${count} 次复习`}
                className={`w-3 h-3 rounded-sm cursor-default ${getColor(count)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 复习模式 ─────────────────────────────────────────────────────────────────
function ReviewMode({ cards, onExit, dailyNewCardLimit = 20 }) {
  const { dispatch } = useApp()
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)

  // 限制每日新卡数量
  const limitedCards = useMemo(() => {
    let newCount = 0
    return cards.filter(c => {
      if (c.repetitions > 0) return true
      if (newCount < dailyNewCardLimit) { newCount++; return true }
      return false
    })
  }, [cards, dailyNewCardLimit])

  const current = limitedCards[index]
  const isCloze = current ? hasCloze(current.front) : false

  function rate(rating) {
    dispatch({ type: 'REVIEW_LEARNING_CARD', payload: { id: current.id, rating } })
    if (index + 1 >= limitedCards.length) {
      setDone(true)
    } else {
      setIndex(i => i + 1)
      setFlipped(false)
    }
  }

  if (done || limitedCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-stone-100">今日复习完成！</h2>
        <p className="text-stone-400 text-sm">共复习了 {limitedCards.length} 张卡片</p>
        <button
          onClick={onExit}
          className="mt-2 px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-medium transition-colors"
        >
          返回知识库
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto px-6 py-6">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="flex items-center gap-1 text-stone-400 hover:text-stone-200 text-sm transition-colors">
          <ChevronLeft size={16} /> 退出复习
        </button>
        <div className="flex items-center gap-3">
          {current.deck && (
            <span className="text-xs text-stone-500 bg-stone-800 px-2 py-0.5 rounded-full">{current.deck}</span>
          )}
          {isCloze && (
            <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30">填空</span>
          )}
          <span className="text-sm text-stone-400">{index + 1} / {limitedCards.length}</span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="h-1.5 bg-stone-800 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-purple-500 rounded-full transition-all duration-500"
          style={{ width: `${(index / limitedCards.length) * 100}%` }}
        />
      </div>

      {/* 卡片 */}
      <div
        onClick={() => !flipped && setFlipped(true)}
        className={`flex-1 flex flex-col items-center justify-center rounded-2xl border cursor-pointer transition-all duration-200 p-8 min-h-48 ${
          flipped
            ? 'bg-stone-800 border-stone-700'
            : 'bg-stone-900 border-stone-700 hover:border-orange-500/50 hover:bg-stone-800/50'
        }`}
      >
        <div className="w-full">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">
            {isCloze ? '填空题' : '正面'}
          </p>
          <p className="text-lg text-stone-100 leading-relaxed">
            {isCloze
              ? <ClozeText text={current.front} revealed={flipped} />
              : current.front
            }
          </p>

          {flipped && !isCloze && (
            <div className="mt-6 pt-6 border-t border-stone-700">
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-3">背面</p>
              <p className="text-base text-stone-300 leading-relaxed">{current.back}</p>
            </div>
          )}

          {flipped && isCloze && current.back && (
            <div className="mt-6 pt-6 border-t border-stone-700">
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-3">补充说明</p>
              <p className="text-base text-stone-300 leading-relaxed">{current.back}</p>
            </div>
          )}

          {!flipped && (
            <div className="mt-8 flex items-center justify-center gap-2 text-stone-500">
              <RotateCcw size={14} />
              <span className="text-sm">{isCloze ? '点击揭示答案' : '点击翻转查看答案'}</span>
            </div>
          )}
        </div>
      </div>

      {/* 评分按钮 */}
      {flipped && (
        <div className="mt-6 grid grid-cols-4 gap-2">
          {[
            { rating: 0, emoji: '😵', label: '忘了', color: 'bg-red-900/40 hover:bg-red-900/70 border-red-800 text-red-300' },
            { rating: 1, emoji: '😅', label: '模糊', color: 'bg-yellow-900/40 hover:bg-yellow-900/70 border-yellow-800 text-yellow-300' },
            { rating: 2, emoji: '😊', label: '掌握', color: 'bg-green-900/40 hover:bg-green-900/70 border-green-800 text-green-300' },
            { rating: 3, emoji: '🎯', label: '熟练', color: 'bg-blue-900/40 hover:bg-blue-900/70 border-blue-800 text-blue-300' },
          ].map(({ rating, emoji, label, color }) => (
            <button
              key={rating}
              onClick={() => rate(rating)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all text-sm font-medium ${color}`}
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 添加卡片 Modal ──────────────────────────────────────────────────────────
function AddCardModal({ onClose, todos, existingDecks }) {
  const { dispatch } = useApp()
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [tags, setTags] = useState('')
  const [deck, setDeck] = useState('')
  const [todoId, setTodoId] = useState('')

  function submit() {
    if (!front.trim() || !back.trim()) return
    dispatch({
      type: 'ADD_LEARNING_CARD',
      payload: {
        front: front.trim(),
        back: back.trim(),
        tags: tags.trim() ? tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean) : [],
        deck: deck.trim(),
        todoId: todoId || null,
      },
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-800">
          <h2 className="font-semibold text-stone-100">新建知识卡片</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide block mb-1.5">
              正面（问题 / 概念）
              <span className="ml-2 text-stone-600 normal-case font-normal">用 {'{{答案}}'} 创建填空题</span>
            </label>
            <textarea
              value={front}
              onChange={e => setFront(e.target.value)}
              placeholder="例如：Python 使用 {{缩进}} 来表示代码块"
              rows={3}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500 resize-none"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide block mb-1.5">
              背面（答案 / 解释）
            </label>
            <textarea
              value={back}
              onChange={e => setBack(e.target.value)}
              placeholder="例如：将用户需求分为基本型、期望型、兴奋型..."
              rows={4}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide block mb-1.5">卡包</label>
              <input
                value={deck}
                onChange={e => setDeck(e.target.value)}
                list="deck-list"
                placeholder="例如：产品管理"
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500"
              />
              <datalist id="deck-list">
                {existingDecks.map(d => <option key={d} value={d} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide block mb-1.5">标签（逗号分隔）</label>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="例如：Python, 编程"
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide block mb-1.5">关联任务（可选）</label>
            <select
              value={todoId}
              onChange={e => setTodoId(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 focus:outline-none focus:border-orange-500"
            >
              <option value="">无</option>
              {todos.filter(t => t.status !== 'completed').map(t => (
                <option key={t.id} value={t.id}>{t.title.slice(0, 40)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={submit}
            disabled={!front.trim() || !back.trim()}
            className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:bg-stone-700 disabled:text-stone-500 text-white text-sm font-medium py-2 rounded-xl transition-colors"
          >
            创建卡片
          </button>
          <button onClick={onClose} className="px-4 text-sm text-stone-400 hover:text-stone-200 transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 卡片列表项 ───────────────────────────────────────────────────────────────
function CardItem({ card, todos }) {
  const { dispatch } = useApp()
  const [expanded, setExpanded] = useState(false)
  const relatedTodo = card.todoId ? todos.find(t => t.id === card.todoId) : null
  const due = isDueToday(card)
  const cloze = hasCloze(card.front)

  return (
    <div className={`bg-stone-900 border rounded-xl transition-all ${
      card.suspended ? 'border-stone-700 opacity-50'
      : card.buriedUntil ? 'border-stone-700 opacity-60'
      : due ? 'border-orange-500/40' : 'border-stone-800'
    }`}>
      <div
        className="flex items-start gap-3 p-3.5 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <BookOpen size={15} className={`mt-0.5 flex-shrink-0 ${due && !card.suspended && !card.buriedUntil ? 'text-orange-400' : 'text-stone-600'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-200 line-clamp-1">
            {cloze ? card.front.replace(/\{\{(.+?)\}\}/g, '[___]') : card.front}
          </p>
          <div className="flex gap-1 mt-1 flex-wrap">
            {card.deck && (
              <span className="text-xs text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Layers size={10} /> {card.deck}
              </span>
            )}
            {card.tags.map(t => (
              <span key={t} className="text-xs text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded-md">{t}</span>
            ))}
            {cloze && <span className="text-xs text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-md border border-purple-500/20">填空</span>}
            {card.suspended && <span className="text-xs text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded-md">已暂缓</span>}
            {card.buriedUntil && !card.suspended && <span className="text-xs text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded-md">明天复习</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${getMasteryColor(card)}`}>
            {getMasteryLabel(card)}
          </span>
          <span className="text-xs text-stone-600">
            {due && !card.suspended && !card.buriedUntil ? '今日' : card.nextReview}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-0">
          <div className="bg-stone-800 rounded-xl p-3 mt-1">
            <p className="text-xs font-semibold text-orange-400 mb-1">{cloze ? '正面（含答案）' : '答案'}</p>
            {cloze ? (
              <p className="text-sm text-stone-300 leading-relaxed">
                <ClozeText text={card.front} revealed={true} />
              </p>
            ) : (
              <p className="text-sm text-stone-300 leading-relaxed">{card.back}</p>
            )}
            {cloze && card.back && (
              <div className="mt-2 pt-2 border-t border-stone-700">
                <p className="text-xs font-semibold text-stone-500 mb-1">补充说明</p>
                <p className="text-sm text-stone-400 leading-relaxed">{card.back}</p>
              </div>
            )}
          </div>
          {relatedTodo && (
            <p className="text-xs text-stone-600 mt-2">关联任务：{relatedTodo.title}</p>
          )}
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-stone-600">
              复习 {card.repetitions} 次 · 间隔 {card.interval} 天
            </span>
            <div className="flex items-center gap-1">
              {card.suspended ? (
                <button
                  onClick={e => { e.stopPropagation(); dispatch({ type: 'UNSUSPEND_CARD', payload: card.id }) }}
                  className="text-xs text-stone-500 hover:text-green-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  <Play size={11} /> 恢复
                </button>
              ) : (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); dispatch({ type: 'BURY_CARD', payload: card.id }) }}
                    className="text-xs text-stone-600 hover:text-yellow-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-800 transition-colors"
                    title="明天再看"
                  >
                    <EyeOff size={11} /> 埋葬
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); dispatch({ type: 'SUSPEND_CARD', payload: card.id }) }}
                    className="text-xs text-stone-600 hover:text-orange-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-800 transition-colors"
                    title="暂停复习"
                  >
                    <Pause size={11} /> 暂缓
                  </button>
                </>
              )}
              <button
                onClick={e => { e.stopPropagation(); dispatch({ type: 'DELETE_LEARNING_CARD', payload: card.id }) }}
                className="text-xs text-stone-600 hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-800 transition-colors"
              >
                <Trash2 size={11} /> 删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 导出 Anki CSV ────────────────────────────────────────────────────────────
function exportAnkiCSV(cards) {
  const rows = [['正面', '背面', '标签', '卡包', '复习次数', '间隔天数', '掌握度']]
  const masteryMap = { new: '新卡片', learning: '学习中', familiar: '熟悉', mastered: '已掌握' }
  cards.forEach(card => {
    const mastery = card.repetitions === 0 ? 'new' : card.interval >= 21 ? 'mastered' : card.interval >= 7 ? 'familiar' : 'learning'
    rows.push([
      card.front,
      card.back,
      card.tags.join(' '),
      card.deck || '',
      card.repetitions,
      card.interval,
      masteryMap[mastery],
    ])
  })
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `taskflow_cards_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── 主视图 ───────────────────────────────────────────────────────────────────
export default function LearningView() {
  const { state, dispatch } = useApp()
  const { learning, todos } = state
  const { cards, reviewStreak, reviewHistory, settings } = learning
  const dailyNewCardLimit = settings?.dailyNewCardLimit ?? 20

  const [reviewMode, setReviewMode] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [tab, setTab] = useState('all') // 'all' | 'due' | 'mastered' | 'suspended'
  const [search, setSearch] = useState('')
  const [selectedDeck, setSelectedDeck] = useState('all')
  const [showSettings, setShowSettings] = useState(false)

  const dueCards = useMemo(() => cards.filter(isDueToday), [cards])
  const masteredCards = useMemo(() => cards.filter(c => c.interval >= 21), [cards])
  const suspendedCards = useMemo(() => cards.filter(c => c.suspended), [cards])
  const existingDecks = useMemo(() => [...new Set(cards.map(c => c.deck).filter(Boolean))].sort(), [cards])

  const displayCards = useMemo(() => {
    let list = tab === 'due' ? dueCards
      : tab === 'mastered' ? masteredCards
      : tab === 'suspended' ? suspendedCards
      : cards
    if (selectedDeck !== 'all') list = list.filter(c => c.deck === selectedDeck)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.front.toLowerCase().includes(q) ||
        c.back.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q)) ||
        (c.deck || '').toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => a.nextReview.localeCompare(b.nextReview))
  }, [cards, tab, dueCards, masteredCards, suspendedCards, search, selectedDeck])

  if (reviewMode) {
    return <ReviewMode cards={dueCards} onExit={() => setReviewMode(false)} dailyNewCardLimit={dailyNewCardLimit} />
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-stone-100">学习记录</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            共 {cards.length} 张 · 待复习 <span className="text-orange-400 font-medium">{dueCards.length}</span> 张
            {reviewStreak > 0 && (
              <span className="ml-2 text-orange-400">
                <Flame size={12} className="inline -mt-0.5" /> {reviewStreak} 天连续
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportAnkiCSV(cards)}
            disabled={cards.length === 0}
            title="导出 CSV（Anki 兼容）"
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 border border-stone-700 hover:border-stone-500 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
          >
            <Download size={13} />
            导出
          </button>
          {dueCards.length > 0 && (
            <button
              onClick={() => setReviewMode(true)}
              className="flex items-center gap-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl transition-colors"
            >
              <RotateCcw size={14} />
              开始复习 ({dueCards.length})
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 text-sm font-medium text-stone-300 hover:text-stone-100 border border-stone-700 hover:border-stone-500 px-3 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} />
            添加
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: '总卡片', value: cards.length, icon: '📚' },
          { label: '今日待复习', value: dueCards.length, icon: '🔔' },
          { label: '已掌握', value: masteredCards.length, icon: '✅' },
          { label: '每日新卡上限', value: dailyNewCardLimit, icon: '🎯', onClick: () => setShowSettings(v => !v) },
        ].map(s => (
          <div
            key={s.label}
            onClick={s.onClick}
            className={`bg-stone-900 border border-stone-800 rounded-xl p-3 text-center ${s.onClick ? 'cursor-pointer hover:border-stone-600 transition-colors' : ''}`}
          >
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-lg font-bold text-stone-100">{s.value}</div>
            <div className="text-xs text-stone-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 每日新卡设置 */}
      {showSettings && (
        <div className="bg-stone-900 border border-stone-700 rounded-xl p-4 mb-4 flex items-center gap-4">
          <span className="text-sm text-stone-300 flex-1">每次复习最多学习新卡片数量</span>
          <input
            type="number"
            min={1} max={100}
            value={dailyNewCardLimit}
            onChange={e => dispatch({ type: 'UPDATE_LEARNING_SETTINGS', payload: { dailyNewCardLimit: Math.max(1, parseInt(e.target.value) || 1) } })}
            className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-sm text-center text-stone-100 focus:outline-none focus:border-orange-500"
          />
          <span className="text-sm text-stone-500">张/次</span>
        </div>
      )}

      {/* 热力图 */}
      <ReviewHeatmap reviewHistory={reviewHistory} />

      {/* Tabs + Deck Filter + Search */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-stone-900 border border-stone-800 rounded-xl p-1">
            {[
              { id: 'all', label: `全部 ${cards.length}` },
              { id: 'due', label: `待复习 ${dueCards.length}` },
              { id: 'mastered', label: `已掌握 ${masteredCards.length}` },
              { id: 'suspended', label: `已暂缓 ${suspendedCards.length}` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  tab === t.id ? 'bg-orange-600 text-white' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {existingDecks.length > 0 && (
            <select
              value={selectedDeck}
              onChange={e => setSelectedDeck(e.target.value)}
              className="bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-sm text-stone-300 focus:outline-none focus:border-stone-600"
            >
              <option value="all">全部卡包</option>
              {existingDecks.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索卡片…"
            className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-stone-600"
          />
        </div>
      </div>

      {/* Card list */}
      {displayCards.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-stone-400 font-medium">
            {cards.length === 0 ? '还没有知识卡片' : '没有符合条件的卡片'}
          </p>
          {cards.length === 0 && (
            <p className="text-stone-600 text-sm mt-1">点击"添加"创建你的第一张知识卡片<br/>用 {'{{答案}}'} 语法可以创建填空题</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayCards.map(card => (
            <CardItem key={card.id} card={card} todos={todos} />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddCardModal
          onClose={() => setShowAddModal(false)}
          todos={todos}
          existingDecks={existingDecks}
        />
      )}
    </div>
  )
}
