import React, { useState, useMemo, useRef } from 'react'
import { 
  Plus, BookOpen, RotateCcw, ChevronLeft, Trash2, Flame, X, 
  FileText, Mic, Upload, Paperclip, Image as ImageIcon, FileAudio
} from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { isDueToday, getMasteryLabel, getMasteryColor, hasCloze, parseCloze } from '../utils/srs.js'

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
      </div>
      <div className="flex gap-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map(({ dateStr, count }) => (
              <div
                key={dateStr}
                className={`w-3 h-3 rounded-sm cursor-default ${getColor(count)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function CornellNoteEditor({ note, onSave, onClose }) {
  const { dispatch } = useApp()
  const [title, setTitle] = useState(note?.title || '')
  const [cues, setCues] = useState(note?.content?.cues || '')
  const [notes, setNotes] = useState(note?.content?.notes || '')
  const [summary, setSummary] = useState(note?.content?.summary || '')
  const [tags, setTags] = useState(note?.tags?.join(', ') || '')
  const [isDragging, setIsDragging] = useState(false)
  const [attachments, setAttachments] = useState(note?.attachments || [])
  const [audioRecordings, setAudioRecordings] = useState(note?.audioRecordings || [])
  const fileInputRef = useRef(null)
  const modalRef = useRef(null)

  function handleSave() {
    const noteData = {
      title: title || '未命名笔记',
      type: 'cornell',
      content: { cues, notes, summary },
      tags: tags.trim() ? tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean) : [],
      attachments,
      audioRecordings,
    }
    if (note) {
      dispatch({ type: 'UPDATE_NOTE', payload: { id: note.id, ...noteData } })
    } else {
      dispatch({ type: 'ADD_NOTE', payload: noteData })
    }
    onSave?.()
    onClose?.()
  }

  function processFiles(files) {
    const newAttachments = []
    const newAudios = []
    
    Array.from(files).forEach(file => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      const fileObj = { id, name: file.name, type: file.type, size: file.size, url: URL.createObjectURL(file), createdAt: new Date().toISOString() }
      if (file.type.startsWith('audio/')) {
        newAudios.push(fileObj)
      } else {
        newAttachments.push(fileObj)
      }
    })
    
    if (newAttachments.length > 0) setAttachments(prev => [...prev, ...newAttachments])
    if (newAudios.length > 0) setAudioRecordings(prev => [...prev, ...newAudios])
  }

  function handleFileUpload(e) {
    const files = e.target.files
    if (files && files.length > 0) processFiles(files)
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (items) {
      const files = []
      for (let item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        processFiles(files)
      }
    }
  }

  function handleOverlayClick(e) {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose?.()
    }
  }

  function removeAttachment(id) {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  function removeAudio(id) {
    setAudioRecordings(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onPaste={handlePaste}
      onClick={handleOverlayClick}
    >
      <div 
        ref={modalRef}
        className={`bg-stone-900 border rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col transition-all ${
          isDragging ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-stone-700'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files) }}
      >
        <div className="flex items-center justify-between p-5 border-b border-stone-800">
          <h2 className="font-semibold text-stone-100 flex items-center gap-2">
            <FileText size={18} className="text-purple-400" />
            {note ? '编辑笔记' : '新建笔记'}
          </h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {isDragging && (
          <div className="absolute inset-0 bg-purple-900/30 z-10 flex items-center justify-center">
            <div className="bg-stone-900 border-2 border-dashed border-purple-500 rounded-2xl px-12 py-8 text-center">
              <Upload size={48} className="mx-auto mb-3 text-purple-400" />
              <p className="text-purple-300 font-medium">拖放文件到这里</p>
              <p className="text-stone-400 text-sm mt-1">或按 Ctrl+V 粘贴</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="笔记标题..."
            className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-lg text-stone-100 placeholder-stone-600 focus:outline-none focus:border-purple-500"
          />

          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="标签（逗号分隔）"
            className="w-full bg-stone-800 border border-stone-700 rounded-xl px-4 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-purple-500"
          />

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">线索</p>
              <textarea
                value={cues}
                onChange={e => setCues(e.target.value)}
                placeholder="关键问题、关键词..."
                rows={12}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">笔记</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="详细笔记内容..."
                rows={12}
                className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">总结</p>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="用自己的话总结..."
              rows={3}
              className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {(attachments.length > 0 || audioRecordings.length > 0) && (
            <div className="space-y-2">
              {audioRecordings.map(audio => (
                <div key={audio.id} className="flex items-center gap-3 bg-stone-800 rounded-lg p-3">
                  <FileAudio size={20} className="text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-stone-200 truncate flex-1">{audio.name}</span>
                  <button onClick={() => removeAudio(audio.id)} className="text-stone-500 hover:text-red-400">
                    <X size={16} />
                  </button>
                </div>
              ))}
              {attachments.map(attachment => (
                <div key={attachment.id} className="flex items-center gap-3 bg-stone-800 rounded-lg p-3">
                  {attachment.type.startsWith('image/') ? (
                    <ImageIcon size={20} className="text-purple-400 flex-shrink-0" />
                  ) : (
                    <Paperclip size={20} className="text-green-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-stone-200 truncate flex-1">{attachment.name}</span>
                  <button onClick={() => removeAttachment(attachment.id)} className="text-stone-500 hover:text-red-400">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-stone-700 hover:bg-stone-600 rounded-xl cursor-pointer transition-colors">
              <Upload size={16} className="text-stone-300" />
              <span className="text-sm text-stone-300">添加附件</span>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
            </label>
            <p className="text-xs text-stone-500 flex items-center">或拖放文件 · 或按 Ctrl+V 粘贴</p>
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-0 border-t border-stone-800">
          <button onClick={handleSave} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium py-2 rounded-xl transition-colors">
            {note ? '保存' : '创建'}
          </button>
          <button onClick={onClose} className="px-4 text-sm text-stone-400 hover:text-stone-200 transition-colors">
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

function NoteItem({ note, onEdit, onReview, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const isDueForReview = note.nextReviewDate && note.nextReviewDate <= today

  return (
    <div className={`bg-stone-900 border rounded-xl transition-all ${
      isDueForReview ? 'border-purple-500/40' : 'border-stone-800'
    }`}>
      <div className="flex items-start gap-3 p-3.5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <FileText size={15} className={`mt-0.5 flex-shrink-0 ${isDueForReview ? 'text-purple-400' : 'text-stone-600'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-200 font-medium">{note.title}</p>
          <div className="flex gap-1 mt-1 flex-wrap items-center">
            {note.tags.map(t => (
              <span key={t} className="text-xs text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded-md">{t}</span>
            ))}
            {note.audioRecordings?.length > 0 && (
              <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Mic size={10} /> {note.audioRecordings.length}
              </span>
            )}
            {note.attachments?.length > 0 && (
              <span className="text-xs text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Paperclip size={10} /> {note.attachments.length}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1">{new Date(note.createdAt).toLocaleDateString('zh-CN')}</p>
        </div>
        {isDueForReview && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-purple-500/40 text-purple-400">待复习</span>
        )}
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 pt-0">
          {note.type === 'cornell' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {note.content?.cues && (
                  <div className="col-span-1 bg-stone-800 rounded-lg p-3">
                    <p className="text-xs font-semibold text-stone-400 mb-1">线索</p>
                    <p className="text-sm text-stone-300 whitespace-pre-wrap">{note.content.cues}</p>
                  </div>
                )}
                {note.content?.notes && (
                  <div className="col-span-2 bg-stone-800 rounded-lg p-3">
                    <p className="text-xs font-semibold text-stone-400 mb-1">笔记</p>
                    <p className="text-sm text-stone-300 whitespace-pre-wrap">{note.content.notes}</p>
                  </div>
                )}
              </div>
              {note.content?.summary && (
                <div className="bg-stone-800 rounded-lg p-3">
                  <p className="text-xs font-semibold text-purple-400 mb-1">总结</p>
                  <p className="text-sm text-stone-300 whitespace-pre-wrap">{note.content.summary}</p>
                </div>
              )}
            </div>
          )}

          {(note.attachments?.length > 0 || note.audioRecordings?.length > 0) && (
            <div className="mt-3 space-y-1">
              {note.audioRecordings?.map(audio => (
                <div key={audio.id} className="flex items-center gap-2 bg-stone-800 rounded-lg p-2">
                  <FileAudio size={16} className="text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-stone-300 truncate flex-1">{audio.name}</span>
                </div>
              ))}
              {note.attachments?.map(attachment => (
                <div key={attachment.id} className="flex items-center gap-2 bg-stone-800 rounded-lg p-2">
                  {attachment.type.startsWith('image/') ? (
                    <ImageIcon size={16} className="text-purple-400 flex-shrink-0" />
                  ) : (
                    <Paperclip size={16} className="text-green-400 flex-shrink-0" />
                  )}
                  <span className="text-sm text-stone-300 truncate flex-1">{attachment.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              {note.reviewHistory?.length > 0 && (
                <span className="text-xs text-stone-500">复习 {note.reviewHistory.length} 次</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isDueForReview && (
                <button
                  onClick={e => { e.stopPropagation(); onReview(note.id) }}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  <RotateCcw size={11} /> 复习
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); onEdit(note) }}
                className="text-xs text-stone-400 hover:text-stone-200 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-800 transition-colors"
              >
                编辑
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(note.id) }}
                className="text-xs text-stone-400 hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-800 transition-colors"
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

function ReviewMode({ cards, onExit, dailyNewCardLimit = 20 }) {
  const { dispatch } = useApp()
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)

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
        <button onClick={onExit} className="mt-2 px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-medium transition-colors">
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="flex items-center gap-1 text-stone-400 hover:text-stone-200 text-sm transition-colors">
          <ChevronLeft size={16} /> 退出复习
        </button>
        <span className="text-sm text-stone-400">{index + 1} / {limitedCards.length}</span>
      </div>

      <div className="h-1.5 bg-stone-800 rounded-full mb-8 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-orange-500 to-purple-500 rounded-full" style={{ width: `${(index / limitedCards.length) * 100}%` }} />
      </div>

      <div onClick={() => !flipped && setFlipped(true)} className={`flex-1 flex flex-col items-center justify-center rounded-2xl border cursor-pointer p-8 min-h-48 ${flipped ? 'bg-stone-800 border-stone-700' : 'bg-stone-900 border-stone-700'}`}>
        <div className="w-full">
          <p className="text-lg text-stone-100 leading-relaxed">
            {isCloze ? <ClozeText text={current.front} revealed={flipped} /> : current.front}
          </p>
          {flipped && !isCloze && (
            <div className="mt-6 pt-6 border-t border-stone-700">
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-3">答案</p>
              <p className="text-base text-stone-300 leading-relaxed">{current.back}</p>
            </div>
          )}
        </div>
      </div>

      {flipped && (
        <div className="mt-6 grid grid-cols-4 gap-2">
          {[
            { rating: 0, emoji: '😵', label: '忘了', color: 'bg-red-900/40' },
            { rating: 1, emoji: '😅', label: '模糊', color: 'bg-yellow-900/40' },
            { rating: 2, emoji: '😊', label: '掌握', color: 'bg-green-900/40' },
            { rating: 3, emoji: '🎯', label: '熟练', color: 'bg-blue-900/40' },
          ].map(({ rating, emoji, label, color }) => (
            <button key={rating} onClick={() => rate(rating)} className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all text-sm font-medium ${color}`}>
              <span className="text-xl">{emoji}</span>
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NoteReviewMode({ notes, onExit }) {
  const { dispatch } = useApp()
  const [index, setIndex] = useState(0)

  const current = notes[index]

  function rate(rating) {
    dispatch({ type: 'REVIEW_NOTE', payload: { id: current.id, rating } })
    if (index + 1 >= notes.length) {
      onExit()
    } else {
      setIndex(i => i + 1)
    }
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <div className="text-5xl">📝</div>
        <h2 className="text-xl font-bold text-stone-100">没有待复习的笔记</h2>
        <button onClick={onExit} className="mt-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors">
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onExit} className="flex items-center gap-1 text-stone-400 hover:text-stone-200 text-sm transition-colors">
          <ChevronLeft size={16} /> 退出复习
        </button>
        <span className="text-sm text-stone-400">{index + 1} / {notes.length}</span>
      </div>

      <div className="h-1.5 bg-stone-800 rounded-full mb-8 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${((index + 1) / notes.length) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col rounded-2xl border border-stone-700 bg-stone-900 p-6 overflow-y-auto">
        <h2 className="text-xl font-bold text-stone-100 mb-4">{current.title}</h2>
        {current.type === 'cornell' && (
          <div className="space-y-4 flex-1">
            {current.content?.notes && (
              <div className="bg-stone-800 rounded-lg p-4">
                <p className="text-xs font-semibold text-stone-400 mb-2">笔记内容</p>
                <p className="text-stone-300 whitespace-pre-wrap">{current.content.notes}</p>
              </div>
            )}
            {current.content?.summary && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                <p className="text-xs font-semibold text-purple-400 mb-2">总结</p>
                <p className="text-stone-300 whitespace-pre-wrap">{current.content.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        {[
          { rating: 0, emoji: '😵', label: '忘记', color: 'bg-red-900/40' },
          { rating: 1, emoji: '😅', label: '模糊', color: 'bg-yellow-900/40' },
          { rating: 2, emoji: '😊', label: '记得', color: 'bg-green-900/40' },
          { rating: 3, emoji: '🎯', label: '熟练', color: 'bg-blue-900/40' },
        ].map(({ rating, emoji, label, color }) => (
          <button key={rating} onClick={() => rate(rating)} className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all text-sm font-medium ${color}`}>
            <span className="text-xl">{emoji}</span>
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function AddCardModal({ onClose, todos, existingDecks }) {
  const { dispatch } = useApp()
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [tags, setTags] = useState('')
  const [deck, setDeck] = useState('')

  function submit() {
    if (!front.trim() || !back.trim()) return
    dispatch({
      type: 'ADD_LEARNING_CARD',
      payload: {
        front: front.trim(),
        back: back.trim(),
        tags: tags.trim() ? tags.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean) : [],
        deck: deck.trim(),
      },
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-800">
          <h2 className="font-semibold text-stone-100">新建知识卡片</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide block mb-1.5">正面</label>
            <textarea value={front} onChange={e => setFront(e.target.value)} rows={3} className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500 resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide block mb-1.5">背面</label>
            <textarea value={back} onChange={e => setBack(e.target.value)} rows={4} className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide block mb-1.5">卡包</label>
              <input value={deck} onChange={e => setDeck(e.target.value)} list="deck-list" className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500" />
              <datalist id="deck-list">{existingDecks.map(d => <option key={d} value={d} />)}</datalist>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-400 uppercase tracking-wide block mb-1.5">标签</label>
              <input value={tags} onChange={e => setTags(e.target.value)} className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-orange-500" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={submit} disabled={!front.trim() || !back.trim()} className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:bg-stone-700 disabled:text-stone-500 text-white text-sm font-medium py-2 rounded-xl transition-colors">
            创建卡片
          </button>
          <button onClick={onClose} className="px-4 text-sm text-stone-400 hover:text-stone-200 transition-colors">取消</button>
        </div>
      </div>
    </div>
  )
}

function CardItem({ card, todos }) {
  const { dispatch } = useApp()
  const [expanded, setExpanded] = useState(false)
  const due = isDueToday(card)
  const cloze = hasCloze(card.front)

  return (
    <div className={`bg-stone-900 border rounded-xl transition-all ${due ? 'border-orange-500/40' : 'border-stone-800'}`}>
      <div className="flex items-start gap-3 p-3.5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <BookOpen size={15} className={`mt-0.5 flex-shrink-0 ${due ? 'text-orange-400' : 'text-stone-600'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-200 line-clamp-1">
            {cloze ? card.front.replace(/\{\{(.+?)\}\}/g, '[___]') : card.front}
          </p>
          <div className="flex gap-1 mt-1 flex-wrap">
            {card.deck && <span className="text-xs text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded-md">{card.deck}</span>}
            {card.tags.map(t => <span key={t} className="text-xs text-stone-500 bg-stone-800 px-1.5 py-0.5 rounded-md">{t}</span>)}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${getMasteryColor(card)}`}>{getMasteryLabel(card)}</span>
      </div>
      {expanded && (
        <div className="px-3.5 pb-3.5 pt-0">
          <div className="bg-stone-800 rounded-xl p-3 mt-1">
            <p className="text-xs font-semibold text-orange-400 mb-1">答案</p>
            {cloze ? <ClozeText text={card.front} revealed={true} /> : <p className="text-sm text-stone-300">{card.back}</p>}
          </div>
          <div className="flex items-center justify-between mt-3">
            <button onClick={e => { e.stopPropagation(); dispatch({ type: 'DELETE_LEARNING_CARD', payload: card.id }) }} className="text-xs text-stone-400 hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-stone-800 transition-colors">
              <Trash2 size={11} /> 删除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function LearningView() {
  const { state, dispatch } = useApp()
  const { learning, todos, notes } = state
  const { cards, reviewStreak, reviewHistory, settings } = learning
  const dailyNewCardLimit = settings?.dailyNewCardLimit ?? 20

  const [activeTab, setActiveTab] = useState('cards')
  const [reviewMode, setReviewMode] = useState(null)
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [showNoteEditor, setShowNoteEditor] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedDeck, setSelectedDeck] = useState('all')

  const dueCards = useMemo(() => cards.filter(isDueToday), [cards])
  const masteredCards = useMemo(() => cards.filter(c => c.interval >= 21), [cards])
  const existingDecks = useMemo(() => [...new Set(cards.map(c => c.deck).filter(Boolean))].sort(), [cards])
  const today = new Date().toISOString().slice(0, 10)
  const dueNotes = useMemo(() => notes.filter(n => n.nextReviewDate && n.nextReviewDate <= today), [notes, today])

  const displayCards = useMemo(() => {
    let list = cards
    if (selectedDeck !== 'all') list = list.filter(c => c.deck === selectedDeck)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q)))
    }
    return [...list].sort((a, b) => a.nextReview.localeCompare(b.nextReview))
  }, [cards, search, selectedDeck])

  const displayNotes = useMemo(() => {
    if (!search.trim()) return notes
    const q = search.toLowerCase()
    return notes.filter(n => n.title.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)))
  }, [notes, search])

  if (reviewMode === 'cards') {
    return <ReviewMode cards={dueCards} onExit={() => setReviewMode(null)} dailyNewCardLimit={dailyNewCardLimit} />
  }
  if (reviewMode === 'notes') {
    return <NoteReviewMode notes={dueNotes} onExit={() => setReviewMode(null)} />
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-stone-100">学习记录</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {activeTab === 'cards' 
              ? `共 ${cards.length} 张 · 待复习 <span className="text-orange-400 font-medium">${dueCards.length}</span>`
              : `共 ${notes.length} 篇 · 待复习 <span className="text-purple-400 font-medium">${dueNotes.length}</span>`
            }
            {reviewStreak > 0 && (
              <span className="ml-2 text-orange-400">
                <Flame size={12} className="inline -mt-0.5" /> {reviewStreak} 天连续
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'cards' && dueCards.length > 0 && (
            <button onClick={() => setReviewMode('cards')} className="flex items-center gap-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl transition-colors">
              <RotateCcw size={14} /> 复习卡片 ({dueCards.length})
            </button>
          )}
          {activeTab === 'notes' && dueNotes.length > 0 && (
            <button onClick={() => setReviewMode('notes')} className="flex items-center gap-2 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl transition-colors">
              <RotateCcw size={14} /> 复习笔记 ({dueNotes.length})
            </button>
          )}
          <button onClick={() => activeTab === 'cards' ? setShowAddCardModal(true) : setShowNoteEditor({})} className="flex items-center gap-2 text-sm font-medium text-stone-300 hover:text-stone-100 border border-stone-700 hover:border-stone-500 px-3 py-2 rounded-xl transition-colors">
            <Plus size={14} />
            {activeTab === 'cards' ? '添加卡片' : '添加笔记'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-stone-900 border border-stone-800 rounded-xl p-1 mb-5">
        <button onClick={() => setActiveTab('cards')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'cards' ? 'bg-orange-600 text-white' : 'text-stone-400 hover:text-stone-200'}`}>
          <BookOpen size={16} /> 知识卡片 {dueCards.length > 0 && <span className="bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded-md text-xs">{dueCards.length}</span>}
        </button>
        <button onClick={() => setActiveTab('notes')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'notes' ? 'bg-purple-600 text-white' : 'text-stone-400 hover:text-stone-200'}`}>
          <FileText size={16} /> 学习笔记 {dueNotes.length > 0 && <span className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-md text-xs">{dueNotes.length}</span>}
        </button>
      </div>

      {activeTab === 'cards' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[{ label: '总卡片', value: cards.length, icon: '📚' }, { label: '今日待复习', value: dueCards.length, icon: '🔔' }, { label: '已掌握', value: masteredCards.length, icon: '✅' }].map(s => (
              <div key={s.label} className="bg-stone-900 border border-stone-800 rounded-xl p-3 text-center">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-lg font-bold text-stone-100">{s.value}</div>
                <div className="text-xs text-stone-500">{s.label}</div>
              </div>
            ))}
          </div>

          <ReviewHeatmap reviewHistory={reviewHistory} />

          <div className="flex flex-col gap-2 mb-4">
            <div className="flex gap-2">
              {existingDecks.length > 0 && (
                <select value={selectedDeck} onChange={e => setSelectedDeck(e.target.value)} className="bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-sm text-stone-300 focus:outline-none">
                  <option value="all">全部卡包</option>
                  {existingDecks.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索…" className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5 text-sm text-stone-200 placeholder-stone-600 focus:outline-none" />
            </div>
          </div>

          {displayCards.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📖</div>
              <p className="text-stone-400 font-medium">{cards.length === 0 ? '还没有知识卡片' : '没有符合条件的卡片'}</p>
            </div>
          ) : (
            <div className="space-y-2">{displayCards.map(card => <CardItem key={card.id} card={card} todos={todos} />)}</div>
          )}
        </>
      )}

      {activeTab === 'notes' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[{ label: '总笔记', value: notes.length, icon: '📝' }, { label: '今日待复习', value: dueNotes.length, icon: '🔔' }, { label: '含附件', value: notes.filter(n => n.attachments?.length > 0 || n.audioRecordings?.length > 0).length, icon: '📎' }].map(s => (
              <div key={s.label} className="bg-stone-900 border border-stone-800 rounded-xl p-3 text-center">
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-lg font-bold text-stone-100">{s.value}</div>
                <div className="text-xs text-stone-500">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索笔记…" className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none" />
          </div>

          {displayNotes.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📝</div>
              <p className="text-stone-400 font-medium">{notes.length === 0 ? '还没有学习笔记' : '没有符合条件的笔记'}</p>
              {notes.length === 0 && <p className="text-stone-600 text-sm mt-1">点击"添加笔记"创建第一篇笔记</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {displayNotes.map(note => (
                <NoteItem
                  key={note.id}
                  note={note}
                  onEdit={n => setShowNoteEditor(n)}
                  onReview={id => {
                    const noteToReview = notes.find(n => n.id === id)
                    if (noteToReview) setReviewMode('notes')
                  }}
                  onDelete={id => {
                    if (window.confirm('确定要删除这篇笔记吗？')) dispatch({ type: 'DELETE_NOTE', payload: id })
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showAddCardModal && <AddCardModal onClose={() => setShowAddCardModal(false)} todos={todos} existingDecks={existingDecks} />}
      {showNoteEditor && <CornellNoteEditor note={showNoteEditor.id ? showNoteEditor : null} onClose={() => setShowNoteEditor(null)} />}
    </div>
  )
}
