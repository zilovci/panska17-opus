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

// Pseudo-emaily — typ udalosti (mimo SMTP)
var EVENT_TYPE_CONFIG = {
  letter_sent:         { label: 'Poštou',             bg: 'bg-stone-200',   text: 'text-stone-700' },
  letter_received:     { label: 'Prijaté poštou',     bg: 'bg-stone-200',   text: 'text-stone-700' },
  submission:          { label: 'Podanie',            bg: 'bg-blue-100',    text: 'text-blue-700' },
  delivery:            { label: 'Doručené úradne',    bg: 'bg-violet-100',  text: 'text-violet-700' },
  filing_additional:   { label: 'Do spisu',           bg: 'bg-orange-100',  text: 'text-orange-700' },
  delivery_receipt:    { label: 'Doručenka',          bg: 'bg-emerald-100', text: 'text-emerald-700' },
  filing_initial:      { label: 'Podanie protistrany', bg: 'bg-red-100',    text: 'text-red-700' },
  inspection_official: { label: 'Úradná obhliadka',   bg: 'bg-violet-100',  text: 'text-violet-700' },
  inspection_file:     { label: 'Nahliadnutie spis',  bg: 'bg-cyan-100',    text: 'text-cyan-700' },
}

// Vzťah emailu/udalosti k úlohe
var RELATION_TYPE_CONFIG = {
  target:     { label: 'Cieľ',     bg: 'bg-red-100',     text: 'text-red-700' },
  evidence:   { label: 'Dôkaz',    bg: 'bg-emerald-100', text: 'text-emerald-700' },
  response:   { label: 'Odpoveď',  bg: 'bg-blue-100',    text: 'text-blue-700' },
  background: { label: 'Pozadie',  bg: 'bg-stone-100',   text: 'text-stone-600' },
  submission: { label: 'Podanie',  bg: 'bg-blue-100',    text: 'text-blue-700' },
  filing:     { label: 'Spis',     bg: 'bg-orange-100',  text: 'text-orange-700' },
  outcome:    { label: 'Výsledok', bg: 'bg-violet-100',  text: 'text-violet-700' },
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
  var [taskEmails, setTaskEmails] = useState([])
  var [sessions, setSessions] = useState([])
  var [sessionItems, setSessionItems] = useState([])
  var [loading, setLoading] = useState(true)
  var [selectedTask, setSelectedTask] = useState(null)
  var [showDone, setShowDone] = useState(false)
  var [typeFilter, setTypeFilter] = useState('all')
  var [undoToast, setUndoToast] = useState(null) // { task: {...}, timeoutId }

  // Stav formulára pre novú úlohu
  var [showNewForm, setShowNewForm] = useState(false)
  var [newTitle, setNewTitle] = useState('')
  var [newDescription, setNewDescription] = useState('')
  var [newPriority, setNewPriority] = useState('normal')
  var [newKauzaId, setNewKauzaId] = useState('')
  var [newKonanieId, setNewKonanieId] = useState('')
  var [newDueDate, setNewDueDate] = useState('')
  var [savingNew, setSavingNew] = useState(false)

  // Auto-dismiss toast po 8 sekundách
  useEffect(function() {
    if (!undoToast) return
    var tid = setTimeout(function() { setUndoToast(null) }, 8000)
    return function() { clearTimeout(tid) }
  }, [undoToast])

  var loadData = useCallback(async function() {
    var [tasksR, kR, koR, tcR, teR, csR, ciR] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('kauzy').select('id, code, name'),
      supabase.from('konania').select('id, code, name, case_number'),
      supabase.from('task_context').select('*').order('created_at', { ascending: false }),
      supabase.from('task_emails').select('*, emails(id, message_id, date, from_name, from_email, to_addresses, subject, text_body, event_type, delivered_via, related_document_ids, recipients_note, is_pseudo)').order('sort_order', { ascending: true }),
      supabase.from('chat_sessions').select('*').order('started_at', { ascending: false }),
      supabase.from('chat_session_items').select('*').order('sort_order', { ascending: true }),
    ])
    setTasks(tasksR.data || [])
    setKauzy(kR.data || [])
    setKonania(koR.data || [])
    setTaskContexts(tcR.data || [])
    setTaskEmails(teR.data || [])
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

  function resetNewForm() {
    setNewTitle('')
    setNewDescription('')
    setNewPriority('normal')
    setNewKauzaId('')
    setNewKonanieId('')
    setNewDueDate('')
  }

  async function createTask() {
    var title = newTitle.trim()
    if (!title) return
    setSavingNew(true)
    var payload = {
      title: title,
      description: newDescription.trim() || null,
      priority: newPriority,
      status: 'open',
      source_type: 'manual',
      kauza_id: newKauzaId ? parseInt(newKauzaId) : null,
      konanie_id: newKonanieId ? parseInt(newKonanieId) : null,
      due_date: newDueDate || null,
    }
    var res = await supabase.from('tasks').insert(payload).select().single()
    setSavingNew(false)
    if (res.error) {
      window.alert('Chyba pri vytváraní úlohy: ' + res.error.message)
      return
    }
    resetNewForm()
    setShowNewForm(false)
    await loadData()
    if (res.data) setSelectedTask(res.data)
  }

  async function deleteTask(task) {
    if (!task) return
    var ctxCount = taskContexts.filter(function(c) { return c.task_id === task.id }).length
    var emCount = taskEmails.filter(function(e) { return e.task_id === task.id }).length
    var sCount = sessions.filter(function(s) { return s.task_id === task.id }).length
    var warning = 'Naozaj zmazať úlohu „' + task.title + '" (#' + task.id + ')?'
    if (ctxCount + emCount + sCount > 0) {
      warning += '\n\nPOZOR: zmaže sa s ňou aj '
      var parts = []
      if (ctxCount) parts.push(ctxCount + ' kontextových záznamov')
      if (emCount) parts.push(emCount + ' prepojených emailov/udalostí')
      if (sCount) parts.push(sCount + ' chat sedení (zostanú v DB ako voľné)')
      warning += parts.join(', ') + '.'
    }
    warning += '\n\nTáto akcia sa nedá vrátiť.'
    if (!window.confirm(warning)) return
    var res = await supabase.from('tasks').delete().eq('id', task.id)
    if (res.error) {
      window.alert('Chyba pri mazaní: ' + res.error.message)
      return
    }
    setSelectedTask(null)
    setUndoToast(null)
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
  function getEmailsForTask(taskId) { return taskEmails.filter(function(te) { return te.task_id === taskId }) }
  function getSessionsForTask(taskId) { return sessions.filter(function(s) { return s.task_id === taskId }) }
  function getItemsForSession(sessionId) { return sessionItems.filter(function(i) { return i.session_id === sessionId }) }
  function getKauza(id) { return id ? kauzy.find(function(k) { return k.id === id }) : null }
  function getKonanie(id) { return id ? konania.find(function(k) { return k.id === id }) : null }

  function renderTaskRow(t, opts) {
    opts = opts || {}
    var st = sc(t.priority)
    var isSelected = selectedTask && selectedTask.id === t.id
    var cc = getContextsForTask(t.id).length
    var ec = getEmailsForTask(t.id).length
    var sCount = getSessionsForTask(t.id).length
    var k = getKauza(t.kauza_id)
    var ko = getKonanie(t.konanie_id)
    var isOpusDev = t.source_type === 'opus_dev'
    var overdueClass = opts.overdue ? 'border-l-2 border-red-400 pl-3 ' : ''

    return (
      <div key={t.id} onClick={function() { setSelectedTask(t) }}
        className={'group flex items-stretch gap-3 py-2.5 px-3 rounded-xl cursor-pointer transition-colors ' + overdueClass + (isSelected ? 'bg-stone-800 text-white' : 'hover:bg-white')}>

        {/* MAIN CONTENT */}
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
            {(cc > 0 || ec > 0 || sCount > 0) && (
              <span className="flex items-center gap-1">
                {cc > 0 && (
                  <span className={'text-[9px] px-1.5 py-0.5 rounded-full font-medium ' + (isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500')} title={cc + ' kontextových záznamov'}>◆ {cc}</span>
                )}
                {ec > 0 && (
                  <span className={'text-[9px] px-1.5 py-0.5 rounded-full font-medium ' + (isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600')} title={ec + ' prepojených udalostí'}>✉ {ec}</span>
                )}
                {sCount > 0 && (
                  <span className={'text-[9px] px-1.5 py-0.5 rounded-full font-medium ' + (isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600')} title={sCount + ' chat sedení'}>⌘ {sCount}</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT-SIDE ACTIONS — vertical stack, visible on hover. Pin top, checkmark bottom. */}
        <div className="flex flex-col items-center justify-between gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={function(e) { e.stopPropagation(); opts.pinned ? unpin(t) : pinToTop(t) }}
            className={'text-sm leading-none ' + (isSelected ? 'text-stone-300 hover:text-white' : 'text-stone-400 hover:text-stone-700')}
            title={opts.pinned ? 'Odopnúť' : 'Pripnúť na vrch'}>
            {opts.pinned ? '⚲' : '⚯'}
          </button>

          {opts.pinned && (
            <div className="flex flex-col gap-0">
              <button onClick={function(e) { e.stopPropagation(); moveManual(t, 'up') }}
                className={'text-[10px] leading-none ' + (isSelected ? 'text-stone-300 hover:text-white' : 'text-stone-400 hover:text-stone-700')}
                title="Presuň vyššie">▲</button>
              <button onClick={function(e) { e.stopPropagation(); moveManual(t, 'down') }}
                className={'text-[10px] leading-none ' + (isSelected ? 'text-stone-300 hover:text-white' : 'text-stone-400 hover:text-stone-700')}
                title="Presuň nižšie">▼</button>
            </div>
          )}

          <button onClick={function(e) { e.stopPropagation(); toggleTask(t) }}
            className={'w-5 h-5 rounded border flex items-center justify-center text-xs leading-none transition-colors ' + (isSelected ? 'border-stone-500 text-stone-200 hover:bg-white/10 hover:text-white' : 'border-emerald-300 text-emerald-500 bg-white hover:bg-emerald-50 hover:border-emerald-500')}
            title="Označiť ako hotové">
            ✓
          </button>
        </div>
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
            Kauzy
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
          {/* Nová úloha */}
          <div>
            {!showNewForm ? (
              <button onClick={function() { setShowNewForm(true) }}
                className="w-full text-left text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-white border border-dashed border-stone-300 hover:border-stone-400 rounded-xl px-4 py-3 transition-colors">
                + Nová úloha
              </button>
            ) : (
              <div className="rounded-xl border border-stone-300 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Nová úloha</div>
                  <button onClick={function() { setShowNewForm(false); resetNewForm() }}
                    className="text-stone-400 hover:text-stone-700 text-sm leading-none">×</button>
                </div>
                <input type="text" placeholder="Titulok úlohy" value={newTitle}
                  onChange={function(e) { setNewTitle(e.target.value) }}
                  autoFocus
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-500" />
                <textarea placeholder="Popis (voliteľné)" value={newDescription}
                  onChange={function(e) { setNewDescription(e.target.value) }}
                  rows={3}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-stone-500 resize-y" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Priorita</label>
                    <select value={newPriority}
                      onChange={function(e) { setNewPriority(e.target.value) }}
                      className="w-full text-sm border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-stone-500 bg-white">
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Termín</label>
                    <input type="date" value={newDueDate}
                      onChange={function(e) { setNewDueDate(e.target.value) }}
                      className="w-full text-sm border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-stone-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Kauza (voliteľné)</label>
                  <select value={newKauzaId}
                    onChange={function(e) { setNewKauzaId(e.target.value) }}
                    className="w-full text-sm border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-stone-500 bg-white">
                    <option value="">— bez kauzy —</option>
                    {kauzy.slice().sort(function(a, b) { return (a.code || '').localeCompare(b.code || '') }).map(function(k) {
                      return <option key={k.id} value={k.id}>{k.code} — {k.name}</option>
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Konanie (voliteľné)</label>
                  <select value={newKonanieId}
                    onChange={function(e) { setNewKonanieId(e.target.value) }}
                    className="w-full text-sm border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-stone-500 bg-white">
                    <option value="">— bez konania —</option>
                    {konania.slice().sort(function(a, b) { return (a.code || '').localeCompare(b.code || '') }).map(function(ko) {
                      return <option key={ko.id} value={ko.id}>{ko.code}{ko.case_number ? ' · ' + ko.case_number : ''} — {ko.name}</option>
                    })}
                  </select>
                </div>
                <div className="flex items-center gap-2 justify-end pt-1">
                  <button onClick={function() { setShowNewForm(false); resetNewForm() }}
                    className="text-xs text-stone-500 hover:text-stone-800 px-3 py-1.5">
                    Zrušiť
                  </button>
                  <button onClick={createTask} disabled={savingNew || !newTitle.trim()}
                    className="text-xs font-medium text-white bg-stone-800 hover:bg-stone-900 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg px-4 py-1.5 transition-colors">
                    {savingNew ? 'Pridávam…' : 'Pridať'}
                  </button>
                </div>
              </div>
            )}
          </div>

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
                    className={'group/done flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer hover:bg-white ' + (isSelected ? 'bg-stone-200' : '')}>
                    <div className="w-4 h-4 rounded border bg-emerald-400 border-emerald-400 flex-shrink-0 flex items-center justify-center">
                      <span className="text-[10px] text-white leading-none">✓</span>
                    </div>
                    <div className="flex-1 text-sm line-through text-stone-400 min-w-0 truncate">
                      <span className="text-[10px] mr-1.5 text-stone-300">#{t.id}</span>
                      {t.title}
                    </div>
                    <button onClick={function(e) { e.stopPropagation(); toggleTask(t) }}
                      className="w-5 h-5 rounded border border-amber-300 text-amber-600 bg-white hover:bg-amber-50 hover:border-amber-500 flex items-center justify-center text-xs leading-none opacity-0 group-hover/done:opacity-100 transition-opacity flex-shrink-0"
                      title="Vrátiť medzi aktívne">
                      ↺
                    </button>
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
            var taskEmailsList = getEmailsForTask(selectedTask.id)
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

                  <div className="flex items-start gap-3">
                    <h2 className="text-lg font-semibold text-stone-800 flex-1 min-w-0">{selectedTask.title}</h2>
                    <button onClick={function() { deleteTask(selectedTask) }}
                      title="Zmazať úlohu"
                      className="flex-shrink-0 text-stone-300 hover:text-red-600 text-sm leading-none p-1 -mr-1 -mt-0.5 transition-colors">
                      🗑
                    </button>
                  </div>

                  {(k || ko) && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                      {k && <span className="text-stone-500"><span className="text-stone-300">Kauza:</span> {k.code} · {k.name}</span>}
                      {ko && <span className="text-stone-500"><span className="text-stone-300">Konanie:</span> {ko.code}{ko.case_number ? ' · ' + ko.case_number : ''}</span>}
                    </div>
                  )}

                  {selectedTask.executive_summary && (
                    <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3">
                      <div className="text-[10px] uppercase tracking-wider text-indigo-600 font-bold mb-2">Executive summary</div>
                      <div className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{selectedTask.executive_summary}</div>
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
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">
                    Prepojené udalosti ({taskEmailsList.length})
                  </div>
                  {taskEmailsList.length === 0 ? (
                    <div className="text-sm text-stone-400">Žiadne prepojené emaily, podania ani úradné doručenia.</div>
                  ) : (
                    <div className="space-y-2">
                      {taskEmailsList.map(function(te) {
                        var em = te.emails || {}
                        var relCfg = RELATION_TYPE_CONFIG[te.relation_type] || { label: te.relation_type || 'Vzťah', bg: 'bg-stone-100', text: 'text-stone-600' }
                        var evtCfg = em.is_pseudo && em.event_type ? EVENT_TYPE_CONFIG[em.event_type] : null
                        var preview = em.text_body ? (em.text_body.length > 280 ? em.text_body.substring(0, 280) + '…' : em.text_body) : null
                        var hasMore = em.text_body && em.text_body.length > 280
                        return (
                          <div key={te.id} className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className={'text-[10px] font-medium px-1.5 py-0.5 rounded ' + relCfg.bg + ' ' + relCfg.text}>{relCfg.label}</span>
                              {evtCfg && (
                                <span className={'text-[10px] font-medium px-1.5 py-0.5 rounded ' + evtCfg.bg + ' ' + evtCfg.text}>{evtCfg.label}</span>
                              )}
                              {em.is_pseudo && !evtCfg && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">Udalosť</span>
                              )}
                              {em.delivered_via && (
                                <span className="text-[9px] uppercase tracking-wider text-stone-400">{em.delivered_via}</span>
                              )}
                              {em.id && <span className="text-[10px] text-stone-300 ml-auto">✉ #{em.id}</span>}
                            </div>
                            <div className="text-sm font-medium text-stone-700 leading-snug">{em.subject || '(bez predmetu)'}</div>
                            <div className="text-[11px] text-stone-500 mt-0.5">
                              {em.from_name || em.from_email || '—'}
                              {em.date && <span className="text-stone-400"> · {formatDateTime(em.date)}</span>}
                            </div>
                            {te.note && (
                              <div className="text-xs text-stone-600 mt-2 bg-stone-50 rounded px-2 py-1.5 italic leading-relaxed">{te.note}</div>
                            )}
                            {em.related_document_ids && em.related_document_ids.length > 0 && (
                              <div className="text-[10px] text-stone-400 mt-2">
                                {em.related_document_ids.map(function(did) { return '📄 #' + did }).join(' · ')}
                              </div>
                            )}
                            {preview && (
                              <details className="mt-2">
                                <summary className="text-[11px] text-stone-500 cursor-pointer hover:text-stone-700">{hasMore ? 'Náhľad textu (' + em.text_body.length + ' znakov)' : 'Text'}</summary>
                                <div className="text-xs text-stone-600 mt-1.5 whitespace-pre-wrap leading-relaxed bg-stone-50/70 rounded p-2 max-h-96 overflow-y-auto">{em.text_body}</div>
                              </details>
                            )}
                          </div>
                        )
                      })}
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
