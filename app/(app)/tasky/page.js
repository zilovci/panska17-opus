'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, sc, formatDate, isOverdue, isSoon } from '../../components/opus'

var TYPE_CONFIG = {
  research: { icon: '🔍', label: 'Zistenia', bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700' },
  draft:    { icon: '📝', label: 'Koncept', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
  evidence: { icon: '📎', label: 'Dôkaz', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
  decision: { icon: '⚖️', label: 'Rozhodnutie', bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700' },
  note:     { icon: '✏️', label: 'Poznámka', bg: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-600' },
}

export default function TaskyPage() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('id') ? parseInt(searchParams.get('id')) : null

  const [tasks, setTasks] = useState([])
  const [taskContexts, setTaskContexts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showDone, setShowDone] = useState(false)

  var loadData = useCallback(async function() {
    var [tasksR, tcR] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('task_context').select('*').order('created_at', { ascending: false }),
    ])
    setTasks(tasksR.data || [])
    setTaskContexts(tcR.data || [])
    setLoading(false)

    // Auto-select highlighted task
    if (highlightId && tasksR.data) {
      var found = tasksR.data.find(function(t) { return t.id === highlightId })
      if (found) setSelectedTask(found)
    }
  }, [highlightId])

  useEffect(function() { loadData() }, [loadData])

  async function toggleTask(task) {
    var ns = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({ status: ns, completed_at: ns === 'done' ? new Date().toISOString() : null }).eq('id', task.id)
    loadData()
    if (selectedTask && selectedTask.id === task.id) {
      setSelectedTask(Object.assign({}, task, { status: ns }))
    }
  }

  if (loading) return <div className="text-center py-20 text-stone-300 text-lg animate-pulse">Načítavam...</div>

  var openTasks = tasks.filter(function(t) { return t.status !== 'done' })
  var doneTasks = tasks.filter(function(t) { return t.status === 'done' })

  function getContextsForTask(taskId) {
    return taskContexts.filter(function(tc) { return tc.task_id === taskId })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-stone-800">Úlohy</h1>
          <p className="text-sm text-stone-400 mt-1">{openTasks.length} otvorených, {doneTasks.length} hotových</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* TASK LIST */}
        <div className="lg:col-span-2 space-y-1">
          {openTasks.map(function(t) {
            var st = sc(t.priority)
            var isSelected = selectedTask && selectedTask.id === t.id
            var cc = getContextsForTask(t.id).length
            return (
              <div key={t.id} onClick={function() { setSelectedTask(t) }}
                className={'flex items-start gap-3 py-3 px-4 rounded-xl cursor-pointer transition-colors ' + (isSelected ? 'bg-stone-800 text-white' : 'hover:bg-white')}>
                <button onClick={function(e) { e.stopPropagation(); toggleTask(t) }}
                  className={'mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ' + (isSelected ? 'border-stone-500 hover:border-white' : 'border-stone-300 hover:border-stone-500')}>
                </button>
                <div className="flex-1 min-w-0">
                  <div className={'text-sm leading-snug ' + (isSelected ? 'text-white' : 'text-stone-700')}>{t.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={isSelected ? { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' } : { backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                    {t.due_date && <span className={'text-[10px] ' + (isSelected ? 'text-stone-300' : isOverdue(t.due_date) ? 'text-red-500 font-medium' : isSoon(t.due_date) ? 'text-amber-500 font-medium' : 'text-stone-400')}>{formatDate(t.due_date)}</span>}
                    {cc > 0 && <span className={'text-[9px] px-1.5 py-0.5 rounded-full font-medium ' + (isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500')}>{cc} zázn.</span>}
                  </div>
                </div>
              </div>
            )
          })}

          {doneTasks.length > 0 && (
            <div className="pt-3">
              <button onClick={function() { setShowDone(!showDone) }} className="text-[10px] text-stone-400 uppercase tracking-wider px-4 py-2 hover:text-stone-600">
                {showDone ? '▼' : '▶'} Hotové ({doneTasks.length})
              </button>
              {showDone && doneTasks.map(function(t) {
                var isSelected = selectedTask && selectedTask.id === t.id
                return (
                  <div key={t.id} onClick={function() { setSelectedTask(t) }}
                    className={'flex items-start gap-3 py-2.5 px-4 rounded-xl cursor-pointer opacity-50 hover:opacity-70 ' + (isSelected ? 'bg-stone-200' : '')}>
                    <div className="mt-0.5 w-4 h-4 rounded border bg-stone-300 border-stone-300 flex-shrink-0 flex items-center justify-center">
                      <span className="text-[10px] text-white">✓</span>
                    </div>
                    <div className="text-sm line-through text-stone-400">{t.title}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* TASK DETAIL */}
        <div className="lg:col-span-3">
          {!selectedTask ? (
            <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
              <div className="text-stone-300 text-3xl mb-2">◇</div>
              <div className="text-sm text-stone-400">Vyber úlohu zo zoznamu</div>
            </div>
          ) : (function() {
            var st = sc(selectedTask.priority)
            var contexts = getContextsForTask(selectedTask.id)
            return (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-stone-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: sc(selectedTask.status).bg, color: sc(selectedTask.status).text }}>{sc(selectedTask.status).label}</span>
                    {selectedTask.due_date && <span className={'text-[10px] font-medium px-2 py-0.5 rounded-full ' + (isOverdue(selectedTask.due_date) ? 'bg-red-100 text-red-600' : isSoon(selectedTask.due_date) ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-500')}>{formatDate(selectedTask.due_date)}</span>}
                  </div>
                  <h2 className="text-lg font-semibold text-stone-800">{selectedTask.title}</h2>
                  {selectedTask.description && <p className="text-sm text-stone-500 mt-3 leading-relaxed">{selectedTask.description}</p>}
                  {selectedTask.context_summary && <div className="mt-3 text-xs text-stone-400 bg-stone-50 rounded-lg px-3 py-2">{selectedTask.context_summary}</div>}
                </div>

                {/* Context */}
                <div className="p-6">
                  {contexts.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-stone-300 text-3xl mb-2">∅</div>
                      <div className="text-sm text-stone-400">Žiadny kontext — bude doplnený z chatov s Claude</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">Kontext ({contexts.length})</div>
                      {contexts.map(function(ctx) {
                        var cfg = TYPE_CONFIG[ctx.context_type] || TYPE_CONFIG.note
                        return (
                          <div key={ctx.id} className={'rounded-xl border p-4 ' + cfg.bg + ' ' + cfg.border}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm">{cfg.icon}</span>
                              <span className={'text-[10px] font-bold uppercase tracking-wider ' + cfg.text}>{cfg.label}</span>
                              <span className="text-[10px] text-stone-400 ml-auto">{formatDate(ctx.created_at)}</span>
                            </div>
                            <div className="text-sm font-medium text-stone-700 mb-1">{ctx.title}</div>
                            <div className="text-[13px] text-stone-600 whitespace-pre-line leading-relaxed break-words">{ctx.content}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-between">
                  <div className="text-[10px] text-stone-300">ID: {selectedTask.id} {selectedTask.source && <span>• {selectedTask.source}</span>}</div>
                  <button onClick={function() { toggleTask(selectedTask) }}
                    className={'text-xs px-4 py-2 rounded-lg font-medium ' + (selectedTask.status === 'done' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200')}>
                    {selectedTask.status === 'done' ? 'Znova otvoriť' : 'Označiť ako hotové'}
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
