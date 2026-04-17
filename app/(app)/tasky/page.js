'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase, sc, formatDate, formatDateTime, isOverdue, isSoon } from '../../components/opus'

var TYPE_CONFIG = {
  research: { icon: '🔍', label: 'Zistenia', bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700' },
  draft:    { icon: '📝', label: 'Koncept', bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
  evidence: { icon: '📎', label: 'Dôkaz', bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
  decision: { icon: '⚖️', label: 'Rozhodnutie', bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700' },
  note:     { icon: '✏️', label: 'Poznámka', bg: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-600' },
}

var SESSION_ITEM_CONFIG = {
  claude_output: { label: 'Výstup Claude', bg: 'bg-violet-50', text: 'text-violet-700' },
  user_note:     { label: 'Moja poznámka', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  upload:        { label: 'Nahraný súbor', bg: 'bg-blue-50', text: 'text-blue-700' },
  decision:      { label: 'Rozhodnutie', bg: 'bg-amber-50', text: 'text-amber-700' },
  reference:     { label: 'Odkaz', bg: 'bg-stone-50', text: 'text-stone-600' },
}

var PRIO_RANK = { urgent: 1, high: 2, medium: 3, normal: 4, low: 5 }
function priorityRank(p) { return PRIO_RANK[p] || 9 }

export default function TaskyPage() {
  var searchParams = useSearchParams()
  var highlightId = searchParams.get('id') ? parseInt(searchParams.get('id')) : null

  var [tasks, setTasks] = useState([])
  var [kauzy, setKauzy] = useState([])
  var [konania, setKonania] = useState([])
  var [taskContexts, setTaskContexts] = useState([])
  var [sessions, setSessions] = useState([])
  var [sessionItems, setSessionItems] = useState([])
  var [loading, setLoading] = useState(true)
  var [selectedTask, setSelectedTask] = useState(null)
  var [showDone, setShowDone] = useState(false)
  var [typeFilter, setTypeFilter] = useState('all')
  var [undoToast, setUndoToast] = useState(null) // { task: {...}, timeoutId }

  // Auto-dismiss toast po 8 sekundách
  useEffect(function() {
    if (!undoToast) return
    var tid = setTimeout(function() { setUndoToast(null) }, 8000)
    return function() { clearTimeout(tid) }
  }, [undoToast])

  var loadData = useCallback(async function() {
    var [tasksR, kR, koR, tcR, csR, ciR] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('kauzy').select('id, code, name'),
      supabase.from('konania').select('id, code, name, case_number'),
      supabase.from('task_context').select('*').order('created_at', { ascending: false }),
      supabase.from('chat_sessions').select('*').order('started_at', { ascending: false }),
      supabase.from('chat_session_items').select('*').order('sort_order', { ascending: true }),
    ])
    setTasks(tasksR.data || [])
    setKauzy(kR.data || [])
    setKonania(koR.data || [])
    setTaskContexts(tcR.data || [])
    setSessions(csR.data || [])
    setSessionItems(ciR.data || [])
    setLoading(false)

    if (highlightId && tasksR.data) {
      var found = tasksR.data.find(function(t) { return t.id === highlightId })
      if (found) setSelectedTask(found)
    }
  }, [highlightId])

  useEffect(function() { loadData() }, [loadData])

  async function toggleTask(task) {
    var ns = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({
      status: ns,
      completed_at: ns === 'done' ? new Date().toISOString() : null,
    }).eq('id', task.id)
    loadData()
    if (selectedTask && selectedTask.id === task.id) {
      setSelectedTask(Object.assign({}, task, { status: ns }))
    }
    // Undo toast + auto-expand Hotové keď označíme úlohu hotovou
    if (ns === 'done') {
      setUndoToast({ task: task, previousStatus: task.status })
      setShowDone(true)
    } else {
      setUndoToast(null)
    }
  }

  async function undoDone() {
    if (!undoToast) return
    var t = undoToast.task
    await supabase.from('tasks').update({
      status: undoToast.previousStatus || 'open',
      completed_at: null,
    }).eq('id', t.id)
    setUndoToast(null)
    loadData()
    if (selectedTask && selectedTask.id === t.id) {
      setSelectedTask(Object.assign({}, t, { status: undoToast.previousStatus || 'open' }))
    }
  }

  async function pinToTop(task) {
    var pinned = tasks.filter(function(t) { return t.manual_order != null })
    var newOrder = pinned.length === 0 ? 1 : Math.min.apply(null, pinned.map(function(t) { return t.manual_order })) - 1
    await supabase.from('tasks').update({ manual_order: newOrder }).eq('id', task.id)
    loadData()
  }

  async function unpin(task) {
    await supabase.from('tasks').update({ manual_order: null }).eq('id', task.id)
    loadData()
  }

  async function moveManual(task, direction) {
    var pinned = tasks.filter(function(t) { return t.manual_order != null && t.status !== 'done' })
      .sort(function(a, b) { return a.manual_order - b.manual_order })
    var idx = pinned.findIndex(function(t) { return t.id === task.id })
    if (idx === -1) return
    var swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= pinned.length) return
    var other = pinned[swapIdx]
    await Promise.all([
      supabase.from('tasks').update({ manual_order: other.manual_order }).eq('id', task.id),
      supabase.from('tasks').update({ manual_order: task.manual_order }).eq('id', other.id),
    ])
    loadData()
  }

  if (loading) return <div className="text-center py-20 text-stone-300 text-lg animate-pulse">Načítavam...</div>

  function passesType(t) {
    if (typeFilter === 'all') return true
    if (typeFilter === 'manual') return t.source_type !== 'opus_dev'
    return t.source_type === typeFilter
  }

  var filtered = tasks.filter(passesType)
  var openTasks = filtered.filter(function(t) { return t.status !== 'done' })
  var doneTasks = filtered.filter(function(t) { return t.status === 'done' })

  var pinnedTasks = openTasks.filter(function(t) { return t.manual_order != null })
    .sort(function(a, b) { return a.manual_order - b.manual_order })
  var unpinnedOpen = openTasks.filter(function(t) { return t.manual_order == null })

  var overdueTasks = unpinnedOpen.filter(function(t) {
    return t.due_date && (isOverdue(t.due_date) || new Date(t.due_date).toDateString() === new Date().toDateString())
  }).sort(function(a, b) {
    return priorityRank(a.priority) - priorityRank(b.priority)
      || (a.due_date || '').localeCompare(b.due_date || '')
  })

  var restTasks = unpinnedOpen.filter(function(t) { return !overdueTasks.includes(t) })
    .sort(function(a, b) {
      return priorityRank(a.priority) - priorityRank(b.priority)
        || (a.due_date || 'z').localeCompare(b.due_date || 'z')
    })

  function getContextsForTask(taskId) { return taskContexts.filter(function(tc) { return tc.task_id === taskId }) }
  function getSessionsForTask(taskId) { return sessions.filter(function(s) { return s.task_id === taskId }) }
  function getItemsForSession(sessionId) { return sessionItems.filter(function(i) { return i.session_id === sessionId }) }
  function getKauza(id) { return id ? kauzy.find(function(k) { return k.id === id }) : null }
  function getKonanie(id) { return id ? konania.find(function(k) { return k.id === id }) : null }

  function renderTaskRow(t, opts) {
    opts = opts || {}
    var st = sc(t.priority)
    var isSelected = selectedTask && selectedTask.id === t.id
    var cc = getContextsForTask(t.id).length
    var sCount = getSessionsForTask(t.id).length
    var k = getKauza(t.kauza_id)
    var ko = getKonanie(t.konanie_id)
    var isOpusDev = t.source_type === 'opus_dev'
    var overdueClass = opts.overdue ? 'border-l-2 border-red-400 pl-3 ' : ''

    return (
      <div key={t.id} onClick={function() { setSelectedTask(t) }}
        className={'group flex items-start gap-2 py-2.5 px-3 rounded-xl cursor-pointer transition-colors ' + overdueClass + (isSelected ? 'bg-stone-800 text-white' : 'hover:bg-white')}>

        {opts.pinned && (
          <div className="flex flex-col gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={function(e) { e.stopPropagation(); moveManual(t, 'up') }}
              className={'text-[10px] leading-none ' + (isSelected ? 'text-stone-300 hover:text-white' : 'text-stone-400 hover:text-stone-700')}
              title="Presuň vyššie">▲</button>
            <button onClick={function(e) { e.stopPropagation(); moveManual(t, 'down') }}
              className={'text-[10px] leading-none ' + (isSelected ? 'text-stone-300 hover:text-white' : 'text-stone-400 hover:text-stone-700')}
              title="Presuň nižšie">▼</button>
          </div>
        )}

        <button onClick={function(e) { e.stopPropagation(); toggleTask(t) }}
          className={'mt-1 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors group/cb ' + (isSelected ? 'border-stone-500 hover:border-white hover:bg-white/10' : 'border-stone-300 hover:border-emerald-500 hover:bg-emerald-50')}
          title="Označiť ako hotové">
          <span className={'text-[9px] leading-none opacity-0 group-hover/cb:opacity-100 transition-opacity ' + (isSelected ? 'text-white' : 'text-emerald-500')}>✓</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className={'text-sm leading-snug ' + (isSelected ? 'text-white' : 'text-stone-700')}>
            <span className={'text-[10px] mr-1.5 ' + (isSelected ? 'text-stone-300' : 'text-stone-300')}>#{t.id}</span>
            {t.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={isSelected ? { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' } : { backgroundColor: st.bg, color: st.text }}>{st.label}</span>
            {isOpusDev && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={isSelected ? { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' } : { backgroundColor: '#EEEDFE', color: '#3C3489' }}>OPUS</span>
            )}
            {k && <span className={'text-[10px] px-1.5 py-0.5 rounded ' + (isSelected ? 'bg-white/10 text-stone-200' : 'bg-stone-100 text-stone-500')}>{k.code}</span>}
            {ko && <span className={'text-[10px] px-1.5 py-0.5 rounded ' + (isSelected ? 'bg-white/10 text-stone-200' : 'bg-stone-100 text-stone-500')}>{ko.code}</span>}
            {t.due_date && <span className={'text-[10px] ' + (isSelected ? 'text-stone-300' : isOverdue(t.due_date) ? 'text-red-500 font-medium' : isSoon(t.due_date) ? 'text-amber-500 font-medium' : 'text-stone-400')}>{formatDate(t.due_date)}</span>}
            {(cc > 0 || sCount > 0) && (
              <span className="flex items-center gap-1 ml-auto">
                {cc > 0 && (
                  <span className={'text-[9px] px-1.5 py-0.5 rounded-full font-medium ' + (isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500')} title={cc + ' kontextových záznamov'}>◆ {cc}</span>
                )}
                {sCount > 0 && (
                  <span className={'text-[9px] px-1.5 py-0.5 rounded-full font-medium ' + (isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600')} title={sCount + ' chat sedení'}>⌘ {sCount}</span>
                )}
              </span>
            )}
          </div>
        </div>

        <button onClick={function(e) { e.stopPropagation(); opts.pinned ? unpin(t) : pinToTop(t) }}
          className={'text-xs flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ' + (isSelected ? 'text-stone-300 hover:text-white' : 'text-stone-400 hover:text-stone-700')}
          title={opts.pinned ? 'Odopnúť' : 'Presunúť na vrch'}>
          {opts.pinned ? '⚲' : '⚯'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-light text-stone-800">Úlohy</h1>
          <p className="text-sm text-stone-400 mt-1">
            {openTasks.length} otvorených · {doneTasks.length} hotových
            {pinnedTasks.length > 0 && <span> · {pinnedTasks.length} na vrchu</span>}
            {overdueTasks.length > 0 && <span className="text-red-500"> · {overdueTasks.length} po termíne</span>}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          <button onClick={function() { setTypeFilter('all') }}
            className={'text-xs px-3 py-1.5 rounded-md transition-colors ' + (typeFilter === 'all' ? 'bg-white text-stone-800 font-medium' : 'text-stone-500 hover:text-stone-700')}>
            Všetky
          </button>
          <button onClick={function() { setTypeFilter('manual') }}
            className={'text-xs px-3 py-1.5 rounded-md transition-colors ' + (typeFilter === 'manual' ? 'bg-white text-stone-800 font-medium' : 'text-stone-500 hover:text-stone-700')}>
            Kauza
          </button>
          <button onClick={function() { setTypeFilter('opus_dev') }}
            className={'text-xs px-3 py-1.5 rounded-md transition-colors ' + (typeFilter === 'opus_dev' ? 'bg-white text-stone-800 font-medium' : 'text-stone-500 hover:text-stone-700')}>
            OPUS vývoj
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LIST */}
        <div className="lg:col-span-2 space-y-4">
          {pinnedTasks.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider px-3 py-1 flex items-center gap-1.5">
                <span>⚲ Na vrchu</span>
                <span className="text-stone-400 font-normal">· {pinnedTasks.length}</span>
              </div>
              <div className="space-y-0.5">
                {pinnedTasks.map(function(t) { return renderTaskRow(t, { pinned: true }) })}
              </div>
            </div>
          )}

          {overdueTasks.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-red-500 uppercase tracking-wider px-3 py-1">
                Dnes a po termíne · {overdueTasks.length}
              </div>
              <div className="space-y-0.5">
                {overdueTasks.map(function(t) { return renderTaskRow(t, { overdue: true }) })}
              </div>
            </div>
          )}

          {restTasks.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-3 py-1">
                Ostatné aktívne · {restTasks.length}
              </div>
              <div className="space-y-0.5">
                {restTasks.map(function(t) { return renderTaskRow(t) })}
              </div>
            </div>
          )}

          {doneTasks.length > 0 && (
            <div className="pt-2">
              <button onClick={function() { setShowDone(!showDone) }}
                className="text-[10px] text-stone-400 uppercase tracking-wider px-3 py-2 hover:text-stone-600">
                {showDone ? '▼' : '▶'} Hotové ({doneTasks.length})
              </button>
              {showDone && doneTasks.map(function(t) {
                var isSelected = selectedTask && selectedTask.id === t.id
                return (
                  <div key={t.id} onClick={function() { setSelectedTask(t) }}
                    className={'flex items-start gap-3 py-2 px-3 rounded-xl cursor-pointer opacity-50 hover:opacity-70 ' + (isSelected ? 'bg-stone-200' : '')}>
                    <div className="mt-0.5 w-4 h-4 rounded border bg-stone-300 border-stone-300 flex-shrink-0 flex items-center justify-center">
                      <span className="text-[10px] text-white">✓</span>
                    </div>
                    <div className="text-sm line-through text-stone-400">
                      <span className="text-[10px] mr-1.5 text-stone-300">#{t.id}</span>
                      {t.title}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* DETAIL */}
        <div className="lg:col-span-3">
          {!selectedTask ? (
            <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
              <div className="text-stone-300 text-3xl mb-2">◇</div>
              <div className="text-sm text-stone-400">Vyber úlohu zo zoznamu</div>
            </div>
          ) : (function() {
            var st = sc(selectedTask.priority)
            var contexts = getContextsForTask(selectedTask.id)
            var taskSessions = getSessionsForTask(selectedTask.id)
            var k = getKauza(selectedTask.kauza_id)
            var ko = getKonanie(selectedTask.konanie_id)
            var isPinned = selectedTask.manual_order != null

            return (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-stone-100">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: sc(selectedTask.status).bg, color: sc(selectedTask.status).text }}>{sc(selectedTask.status).label}</span>
                    {selectedTask.source_type === 'opus_dev' && (
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: '#EEEDFE', color: '#3C3489' }}>OPUS vývoj</span>
                    )}
                    {selectedTask.due_date && <span className={'text-[10px] font-medium px-2 py-0.5 rounded-full ' + (isOverdue(selectedTask.due_date) ? 'bg-red-100 text-red-600' : isSoon(selectedTask.due_date) ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-500')}>{formatDate(selectedTask.due_date)}</span>}
                    {isPinned && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-600">⚲ Na vrchu</span>}
                  </div>

                  <h2 className="text-lg font-semibold text-stone-800">{selectedTask.title}</h2>

                  {(k || ko) && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                      {k && <span className="text-stone-500"><span className="text-stone-300">Kauza:</span> {k.code} · {k.name}</span>}
                      {ko && <span className="text-stone-500"><span className="text-stone-300">Konanie:</span> {ko.code}{ko.case_number ? ' · ' + ko.case_number : ''}</span>}
                    </div>
                  )}

                  {selectedTask.description && <p className="text-sm text-stone-500 mt-3 leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>}
                  {selectedTask.context_summary && (
                    <div className="mt-3 text-xs text-stone-600 bg-indigo-50/50 border-l-2 border-indigo-200 rounded px-3 py-2 whitespace-pre-wrap">
                      <div className="text-[10px] uppercase tracking-wider text-indigo-400 font-medium mb-1">Zhrnutie OPUS kontextu</div>
                      {selectedTask.context_summary}
                    </div>
                  )}
                </div>

                <div className="px-6 py-5 border-b border-stone-100">
                  {contexts.length === 0 ? (
                    <div className="text-center py-4">
                      <div className="text-sm text-stone-400">Žiadny kontext — bude doplnený z chatov s Claude</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Kontext ({contexts.length})</div>
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
                            {(ctx.email_id || ctx.document_id || ctx.analysis_id) && (
                              <div className="text-[10px] text-stone-400 mt-2">
                                {ctx.email_id && <span className="mr-2">✉ Email #{ctx.email_id}</span>}
                                {ctx.document_id && <span className="mr-2">📄 Dokument #{ctx.document_id}</span>}
                                {ctx.analysis_id && <span>∑ Analýza #{ctx.analysis_id}</span>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="px-6 py-5 border-b border-stone-100">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">
                    Chat sedenia ({taskSessions.length})
                  </div>
                  {taskSessions.length === 0 ? (
                    <div className="text-sm text-stone-400">Žiadne sedenia. Každý chat so Claude týkajúci sa tejto úlohy tu bude zaznamenaný.</div>
                  ) : (
                    <div className="space-y-3">
                      {taskSessions.map(function(s) {
                        var items = getItemsForSession(s.id)
                        return (
                          <div key={s.id} className="rounded-xl border border-stone-200 bg-stone-50/60 overflow-hidden">
                            <div className="px-4 py-3 bg-white border-b border-stone-200">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Sedenie</span>
                                <span className="text-[10px] text-stone-400 ml-auto">{formatDateTime(s.started_at)}</span>
                              </div>
                              <div className="text-sm font-medium text-stone-700">{s.title}</div>
                              {s.claude_summary && (
                                <details className="mt-2">
                                  <summary className="text-[11px] text-stone-500 cursor-pointer hover:text-stone-700">Zhrnutie Claude</summary>
                                  <div className="text-xs text-stone-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{s.claude_summary}</div>
                                </details>
                              )}
                              {s.user_notes && (
                                <details className="mt-2" open>
                                  <summary className="text-[11px] text-emerald-600 cursor-pointer hover:text-emerald-800 font-medium">Moje poznámky</summary>
                                  <div className="text-xs text-stone-700 mt-1.5 whitespace-pre-wrap leading-relaxed bg-emerald-50/60 rounded p-2">{s.user_notes}</div>
                                </details>
                              )}
                            </div>
                            {items.length > 0 && (
                              <div className="px-4 py-3 space-y-2">
                                {items.map(function(it) {
                                  var cfg = SESSION_ITEM_CONFIG[it.item_type] || SESSION_ITEM_CONFIG.reference
                                  return (
                                    <div key={it.id} className="flex items-start gap-3">
                                      <span className={'text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ' + cfg.bg + ' ' + cfg.text + ' font-medium'} style={{ minWidth: '80px', textAlign: 'center' }}>
                                        {cfg.label}
                                      </span>
                                      <div className="text-xs text-stone-600 flex-1">
                                        <div className="font-medium text-stone-700">
                                          {it.is_pinned && <span className="text-amber-500 mr-1">⬥</span>}
                                          {it.title}
                                        </div>
                                        {it.content && <div className="text-[11px] text-stone-500 mt-0.5 whitespace-pre-wrap leading-relaxed">{it.content}</div>}
                                        {(it.email_id || it.document_id || it.analysis_id || it.email_collection_id) && (
                                          <div className="text-[10px] text-stone-400 mt-1">
                                            {it.email_id && <span className="mr-2">✉ Email #{it.email_id}</span>}
                                            {it.document_id && <span className="mr-2">📄 Dokument #{it.document_id}</span>}
                                            {it.analysis_id && <span className="mr-2">∑ Analýza #{it.analysis_id}</span>}
                                            {it.email_collection_id && <span>☰ Kolekcia #{it.email_collection_id}</span>}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {(selectedTask.outcome_email_id || selectedTask.outcome_document_id || selectedTask.outcome_note || selectedTask.closed_at) && (
                  <div className="px-6 py-5 border-b border-stone-100 bg-emerald-50/30">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-3">
                      ✓ Uzavretie úlohy
                    </div>
                    {selectedTask.closed_at && <div className="text-xs text-stone-500 mb-2">Uzavreté: {formatDateTime(selectedTask.closed_at)}</div>}
                    {selectedTask.outcome_email_id && <div className="text-sm text-stone-700">✉ Email #{selectedTask.outcome_email_id}</div>}
                    {selectedTask.outcome_document_id && <div className="text-sm text-stone-700">📄 Dokument #{selectedTask.outcome_document_id}</div>}
                    {selectedTask.outcome_note && <div className="text-sm text-stone-600 mt-2 whitespace-pre-wrap">{selectedTask.outcome_note}</div>}
                  </div>
                )}

                <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-[10px] text-stone-300">
                    ID: {selectedTask.id}
                    {selectedTask.source && <span> · {selectedTask.source}</span>}
                    {selectedTask.updated_at && <span> · upravené {formatDate(selectedTask.updated_at)}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={function() { isPinned ? unpin(selectedTask) : pinToTop(selectedTask) }}
                      className="text-xs px-3 py-2 rounded-lg font-medium bg-stone-100 text-stone-600 hover:bg-stone-200">
                      {isPinned ? '⚲ Odopnúť' : '⚯ Pripnúť na vrch'}
                    </button>
                    <button onClick={function() { toggleTask(selectedTask) }}
                      className={'text-xs px-4 py-2 rounded-lg font-medium ' + (selectedTask.status === 'done' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200')}>
                      {selectedTask.status === 'done' ? 'Znova otvoriť' : 'Označiť ako hotové'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* UNDO TOAST */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-800 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 min-w-[320px] max-w-[500px]">
          <span className="text-emerald-400 text-sm">✓</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-stone-300">Označené hotové</div>
            <div className="text-sm truncate">{undoToast.task.title}</div>
          </div>
          <button onClick={undoDone}
            className="text-sm font-medium text-amber-300 hover:text-amber-100 px-3 py-1 rounded-lg hover:bg-white/10 transition-colors">
            Späť
          </button>
          <button onClick={function() { setUndoToast(null) }}
            className="text-stone-400 hover:text-white px-1 text-lg leading-none"
            title="Zavrieť">×</button>
        </div>
      )}
    </div>
  )
}
