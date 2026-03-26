// SM-2 间隔重复算法
// rating: 0=忘了, 1=模糊, 2=掌握, 3=熟练

export function createCard({ front, back, todoId = null, tags = [], deck = '' }) {
  const today = todayStr()
  return {
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    front,
    back,
    todoId,
    tags,
    deck,
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    nextReview: today,
    createdAt: new Date().toISOString(),
    lastReviewedAt: null,
    suspended: false,
    buriedUntil: null,
  }
}

export function reviewCard(card, rating) {
  let { interval, easeFactor, repetitions } = card

  let newInterval, newEF, newReps

  if (rating === 0) {
    newInterval = 1
    newEF = Math.max(1.3, easeFactor - 0.2)
    newReps = 0
  } else {
    newEF = easeFactor + (0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02))
    newEF = Math.max(1.3, Math.min(2.8, newEF))
    newReps = repetitions + 1

    if (rating === 1) {
      newInterval = Math.max(1, Math.round(interval * 0.6))
    } else if (repetitions === 0) {
      newInterval = 1
    } else if (repetitions === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(interval * newEF)
      if (rating === 3) newInterval = Math.round(newInterval * 1.3)
    }
  }

  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval)

  return {
    ...card,
    interval: newInterval,
    easeFactor: newEF,
    repetitions: newReps,
    nextReview: nextReviewDate.toISOString().slice(0, 10),
    lastReviewedAt: new Date().toISOString(),
  }
}

export function isDueToday(card) {
  if (card.suspended) return false
  if (card.buriedUntil && card.buriedUntil >= todayStr()) return false
  return card.nextReview <= todayStr()
}

export function getMasteryLevel(card) {
  if (card.repetitions === 0) return 'new'
  if (card.interval >= 21) return 'mastered'
  if (card.interval >= 7) return 'familiar'
  return 'learning'
}

export function getMasteryLabel(card) {
  const level = getMasteryLevel(card)
  return { new: '新卡片', learning: '学习中', familiar: '熟悉', mastered: '已掌握' }[level]
}

export function getMasteryColor(card) {
  const level = getMasteryLevel(card)
  return {
    new: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    learning: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    familiar: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    mastered: 'text-green-400 bg-green-500/10 border-green-500/30',
  }[level]
}

// 填空题：检测 {{...}} 语法
export function hasCloze(text) {
  return /\{\{.+?\}\}/.test(text)
}

// 解析填空题，返回 [{type:'text'|'cloze', value}]
export function parseCloze(text) {
  const parts = []
  let last = 0
  const regex = /\{\{(.+?)\}\}/g
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) })
    parts.push({ type: 'cloze', value: match[1] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
