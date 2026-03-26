import React, { useState, useEffect } from 'react'
import { useApp } from '../store/AppContext.jsx'

const STEPS = [
  {
    emoji: '👋',
    title: '欢迎使用 TaskFlow',
    desc: '一款专为效率爱好者设计的任务管理工具。快速了解核心功能，让你立刻上手。',
    tip: null,
  },
  {
    emoji: '⚡',
    title: '自然语言输入',
    desc: '按 Q 或点击"新建任务"，用自然语言快速创建任务。',
    tip: [
      '明天下午3点开会 P1',
      '每周一读书 1小时',
      '周五前完成报告 #工作',
    ],
  },
  {
    emoji: '🎯',
    title: '焦点模式',
    desc: '在 Today 视图设置今日焦点任务，配合番茄钟专注完成，形成计划→执行闭环。',
    tip: null,
  },
  {
    emoji: '📚',
    title: '学习记录（新功能）',
    desc: '在"学习记录"视图创建知识卡片，系统用间隔重复算法帮你安排复习，真正掌握知识。',
    tip: null,
  },
  {
    emoji: '🚀',
    title: '开始使用',
    desc: '一切准备就绪！快去创建你的第一个任务吧。',
    tip: null,
  },
]

export default function Onboarding() {
  const { state, dispatch } = useApp()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const done = localStorage.getItem('taskflow-onboarded')
    if (!done) setVisible(true)
  }, [])

  function finish() {
    localStorage.setItem('taskflow-onboarded', '1')
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-orange-500' : i < step ? 'w-1.5 bg-orange-700' : 'w-1.5 bg-stone-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <div className="text-5xl mb-4">{current.emoji}</div>
          <h2 className="text-lg font-bold text-stone-100 mb-2">{current.title}</h2>
          <p className="text-sm text-stone-400 leading-relaxed">{current.desc}</p>

          {current.tip && (
            <div className="mt-4 bg-stone-800 rounded-xl p-3 text-left space-y-1.5">
              <p className="text-xs font-semibold text-stone-500 mb-2">语法示例：</p>
              {current.tip.map(t => (
                <div key={t} className="flex items-center gap-2">
                  <span className="text-orange-500 text-xs">›</span>
                  <code className="text-xs text-stone-300 font-mono">{t}</code>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-6 pb-6">
          {!isLast ? (
            <>
              <button
                onClick={finish}
                className="text-sm text-stone-500 hover:text-stone-300 transition-colors px-2"
              >
                跳过
              </button>
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                下一步 →
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                finish()
                dispatch({ type: 'TOGGLE_NLP_INPUT' })
              }}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              ⚡ 创建第一个任务
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
