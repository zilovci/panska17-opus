'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ─── Color helpers ───────────────────────────────────────────
const priorityStyle = {
  urgent:  'bg-[#FCEBEB] text-[#E24B4A]',
  high:    'bg-[#FAEEDA] text-[#EF9F27]',
  normal:  'bg-[#E1F5EE] text-[#1D9E75]',
  low:     'bg-[#E6F1FB] text-[#378ADD]',
}
const priorityLabel = { urgent: 'Urgentné', high: 'Vysoká', normal: 'Normálna', low: 'Nízka' }

const statusStyle = {
  active:     'bg-[#FCEBEB] text-[#E24B4A] border border-[#E24B4A]/20',
  monitoring: 'bg-[#FAEEDA] text-[#EF9F27] border border-[#EF9F27]/20',
  resolved:   'bg-stone-100 text-stone-500 border border-stone-200',
}
const statusLabel = { active: 'Aktívne', monitoring: 'Monitorovanie', resolved: 'Uzavreté' }

const taskStatusStyle = {
  open:        'border-[#E24B4A]',
  in_progress: 'border-[#EF9F27] bg-[#FAEEDA]',
  done:        'border-[#1D9E75] bg-[#E1F5EE]',
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(d) {
  if (!d) return null
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000)
  return diff
}

// ─── Login ───────────────────────────────────────────────────
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      if (signInError.message.includes('Invalid') || signInError.message.includes('invalid') || signInError.message.includes('Database')) {
        const { error: signUpError } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: email.split('@')[0] } }
        })
        if (signUpError) { setError(signUpError.message); setLoading(false) }
      } else { setError(signInError.message); setLoading(false) }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-light tracking-[0.3em] mb-2 text-stone-800">OPUS</h1>
          <div className="w-12 h-px bg-stone-300 mx-auto mb-3" />
          <p className="text-stone-400 text-sm tracking-wide">Panská 17, Bratislava</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg shadow-stone-200/50 border border-stone-200/60 p-8">
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-xs font-medium text-stone-500 mb-1.5 tracking-wide uppercase">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 text-sm" required />
            </div>
            <div className="mb-6">
              <label className="block text-xs font-medium text-stone-500 mb-1.5 tracking-wide uppercase">Heslo</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 text-sm" required />
            </div>
            {error && <div className="mb-4 text-[#E24B4A] text-sm text-center bg-[#FCEBEB] rounded-lg p-2">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-stone-800 text-white rounded-xl hover:bg-stone-900 disabled:opacity-50 text-sm font-medium tracking-wide transition-colors">
              {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

// ─── Search ──────────────────────────────────────────────────
function SearchOverlay({ open, onClose }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState({ emails: [], documents: [], cases: [] })
  const [searching, setSearching] = useState(false)

  const doSearch = useCallback(async (term) => {
    if (term.length < 2) { setResults({ emails: [], documents: [], cases: [] }); return }
    setSearching(true)
    const [emails, docs, cases] = await Promise.all([
      supabase.from('emails').select('id, date, from_name, from_email, subject').or(`subject.ilike.%${term}%,from_name.ilike.%${term}%,text_body.ilike.%${term}%`).order('date', { ascending: false }).limit(8),
      supabase.from('documents').select('id, filename, folder, date, extension').or(`filename.ilike.%${term}%,text_body.ilike.%${term}%`).order('date', { ascending: false, nullsFirst: false }).limit(8),
      supabase.from('cases').select('id, code, name, status').or(`name.ilike.%${term}%,description.ilike.%${term}%,notes.ilike.%${term}%`).limit(5),
    ])
    setResults({ emails: emails.data || [], documents: docs.data || [], cases: cases.data || [] })
    setSearching(false)
  }, [])

  useEffect(() => {
    if (!open) { setQ(''); setResults({ emails: [], documents: [], cases: [] }) }
  }, [open])

  useEffect(() => {
    const t = setTimeout(() => doSearch(q), 300)
    return () => clearTimeout(t)
  }, [q, doSearch])

  if (!open) return null
  const total = results.emails.length + results.documents.length + results.cases.length

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
          <svg className="w-5 h-5 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2"/><path d="m21 21-4.3-4.3" strokeWidth="2" strokeLinecap="round"/></svg>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} autoFocus
            placeholder="Hľadať v emailoch, dokumentoch, kauzách..."
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-stone-300" />
          <kbd className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 hidden sm:block">ESC</kbd>
        </div>
        {q.length >= 2 && (
          <div className="max-h-[60vh] overflow-y-auto p-3">
            {searching && <p className="text-sm text-stone-400 text-center py-8">Hľadám...</p>}
            {!searching && total === 0 && <p className="text-sm text-stone-400 text-center py-8">Žiadne výsledky pre &ldquo;{q}&rdquo;</p>}

            {results.cases.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-2 mb-1">Kauzy</p>
                {results.cases.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 cursor-pointer">
                    <span className="font-mono text-xs font-medium bg-stone-100 px-2 py-0.5 rounded">{c.code}</span>
                    <span className="text-sm text-stone-700">{c.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ml-auto ${statusStyle[c.status] || 'bg-stone-100 text-stone-500'}`}>{statusLabel[c.status] || c.status}</span>
                  </div>
                ))}
              </div>
            )}
            {results.emails.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-2 mb-1">Emaily</p>
                {results.emails.map(e => (
                  <div key={e.id} className="px-3 py-2 rounded-lg hover:bg-stone-50 cursor-pointer">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-stone-800 font-medium truncate max-w-[250px]">{e.subject || '(bez predmetu)'}</span>
                      <span className="text-stone-400 text-xs ml-auto flex-shrink-0">{fmtDate(e.date)}</span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">{e.from_name || e.from_email}</p>
                  </div>
                ))}
              </div>
            )}
            {results.documents.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-2 mb-1">Dokumenty</p>
                {results.documents.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 cursor-pointer">
                    <span className="text-[10px] font-mono bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded uppercase">{d.extension || '?'}</span>
                    <span className="text-sm text-stone-700 truncate">{d.filename}</span>
                    <span className="text-xs text-stone-400 ml-auto flex-shrink-0">{d.folder}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ───────────────────────────────────────────────
function Dashboard({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [caseFilter, setCaseFilter] = useState('all') // all, active, monitoring, resolved

  useEffect(() => {
    async function load() {
      const [emails, docs, cases, tasks, analyses, timeline, memory] = await Promise.all([
        supabase.from('emails').select('id', { count: 'exact', head: true }),
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('cases').select('*').order('priority', { ascending: true }),
        supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('analyses').select('*').order('created_at', { ascending: false }),
        supabase.from('timeline_events').select('*').order('date', { ascending: false }).limit(10),
        supabase.from('memory').select('id', { count: 'exact', head: true }),
      ])
      setData({
        emailCount: emails.count || 0,
        docCount: docs.count || 0,
        memoryCount: memory.count || 0,
        cases: cases.data || [],
        tasks: tasks.data || [],
        analyses: analyses.data || [],
        timeline: timeline.data || [],
      })
      setLoading(false)
    }
    load()
  }, [])

  // Keyboard shortcut for search
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-light tracking-[0.3em] text-stone-300 mb-4">OPUS</h1>
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-500 rounded-full animate-spin mx-auto" />
      </div>
    </main>
  )

  const activeCases = data.cases.filter(c => c.status === 'active')
  const openTasks = data.tasks.filter(t => t.status !== 'done')
  const urgentTasks = openTasks.filter(t => t.priority === 'urgent')
  const upcomingDeadlines = data.tasks.filter(t => {
    if (t.status === 'done' || !t.due_date) return false
    const d = daysUntil(t.due_date)
    return d !== null && d <= 7
  })

  const filteredCases = caseFilter === 'all' ? data.cases : data.cases.filter(c => c.status === caseFilter)

  // Priority sort for cases
  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
  const sortedCases = [...filteredCases].sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3))

  return (
    <>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="min-h-screen">
        {/* ─── HEADER ─── */}
        <header className="bg-white border-b border-stone-200/80 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg sm:text-xl font-light tracking-[0.2em] text-stone-800">OPUS</h1>
                <p className="text-[10px] text-stone-400 tracking-wide hidden sm:block">Panská 17 — case management</p>
              </div>
              <div className="hidden md:flex items-center gap-3 ml-6 pl-6 border-l border-stone-200">
                <span className="text-xs text-stone-400"><strong className="text-stone-600 font-mono">{data.cases.length}</strong> kauz</span>
                <span className="text-stone-200">·</span>
                <span className="text-xs text-stone-400"><strong className="text-stone-600 font-mono">{data.emailCount.toLocaleString()}</strong> emailov</span>
                <span className="text-stone-200">·</span>
                <span className="text-xs text-stone-400"><strong className="text-stone-600 font-mono">{data.docCount.toLocaleString()}</strong> dokumentov</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 hover:border-stone-300 text-stone-400 hover:text-stone-600 transition-colors text-xs">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2"/><path d="m21 21-4.3-4.3" strokeWidth="2" strokeLinecap="round"/></svg>
                <span className="hidden sm:inline">Hľadať</span>
                <kbd className="text-[9px] text-stone-300 bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200 hidden md:block">⌘K</kbd>
              </button>
              <div className="hidden sm:flex items-center gap-2 text-xs text-stone-400">
                <span>{user.email}</span>
              </div>
              <button onClick={() => supabase.auth.signOut()}
                className="text-xs text-stone-400 hover:text-[#E24B4A] transition-colors px-2 py-1">
                Odhlásiť
              </button>
            </div>
          </div>
        </header>

        {/* ─── MAIN CONTENT ─── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {/* ─── METRICS ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <MetricCard label="Aktívne kauzy" value={activeCases.length} color="red" sub={`z ${data.cases.length} celkom`} />
            <MetricCard label="Blížiace sa lehoty" value={upcomingDeadlines.length} color={upcomingDeadlines.length > 0 ? 'amber' : 'teal'} sub="do 7 dní" />
            <MetricCard label="Otvorené úlohy" value={openTasks.length} color={urgentTasks.length > 0 ? 'amber' : 'teal'} sub={urgentTasks.length > 0 ? `${urgentTasks.length} urgentných` : 'žiadne urgentné'} />
            <MetricCard label="Memory" value={data.memoryCount} color="blue" sub="záznamov v pamäti" />
          </div>

          {/* ─── TWO COLUMNS ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ═══ LEFT COLUMN (2/3) ═══ */}
            <div className="lg:col-span-2 space-y-6">

              {/* Case filter tabs */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-800 tracking-wide uppercase">Konania</h2>
                <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
                  {['all', 'active', 'monitoring', 'resolved'].map(f => (
                    <button key={f} onClick={() => setCaseFilter(f)}
                      className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${caseFilter === f ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>
                      {f === 'all' ? 'Všetky' : statusLabel[f]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cases list */}
              <div className="space-y-3">
                {sortedCases.map(c => (
                  <CaseCard key={c.id} c={c} tasks={data.tasks.filter(t => t.case_id === c.id)} />
                ))}
                {sortedCases.length === 0 && (
                  <div className="text-center py-12 text-stone-400 text-sm">Žiadne konania v tejto kategórii</div>
                )}
              </div>

              {/* Timeline */}
              {data.timeline.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-stone-800 tracking-wide uppercase mb-4">Časová os</h2>
                  <div className="bg-white rounded-xl border border-stone-200/60 divide-y divide-stone-100">
                    {data.timeline.map(ev => (
                      <div key={ev.id} className="px-4 py-3 flex items-start gap-3">
                        <span className="text-xs text-stone-400 font-mono mt-0.5 flex-shrink-0 w-20">{fmtDate(ev.date)}</span>
                        <div>
                          <p className="text-sm text-stone-800 font-medium">{ev.title}</p>
                          {ev.description && <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{ev.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ RIGHT COLUMN (1/3) ═══ */}
            <div className="space-y-6">

              {/* Tasks */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-stone-800 tracking-wide uppercase">Úlohy</h2>
                  <span className="text-[10px] font-mono text-stone-400">{openTasks.length} otvorených</span>
                </div>
                <div className="bg-white rounded-xl border border-stone-200/60 divide-y divide-stone-100 max-h-[400px] overflow-y-auto">
                  {data.tasks.filter(t => t.status !== 'done').sort((a, b) => {
                    const po = { urgent: 0, high: 1, normal: 2, low: 3 }
                    return (po[a.priority] || 3) - (po[b.priority] || 3)
                  }).map(t => (
                    <div key={t.id} className="px-4 py-3 flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full border-2 mt-0.5 flex-shrink-0 ${taskStatusStyle[t.status] || 'border-stone-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-800 leading-snug">{t.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityStyle[t.priority] || 'bg-stone-100 text-stone-500'}`}>{priorityLabel[t.priority] || t.priority}</span>
                          {t.due_date && (
                            <span className={`text-[10px] font-mono ${daysUntil(t.due_date) <= 0 ? 'text-[#E24B4A] font-semibold' : daysUntil(t.due_date) <= 3 ? 'text-[#EF9F27]' : 'text-stone-400'}`}>
                              {daysUntil(t.due_date) <= 0 ? 'DNES / PREPAD' : `o ${daysUntil(t.due_date)} d.`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {openTasks.length === 0 && (
                    <div className="text-center py-6 text-stone-400 text-xs">Všetky úlohy dokončené</div>
                  )}
                </div>
                {/* Completed tasks count */}
                {data.tasks.filter(t => t.status === 'done').length > 0 && (
                  <p className="text-[10px] text-stone-400 mt-2 text-center">
                    ✓ {data.tasks.filter(t => t.status === 'done').length} dokončených
                  </p>
                )}
              </div>

              {/* AI Analyses */}
              {data.analyses.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-stone-800 tracking-wide uppercase mb-3">AI analýzy</h2>
                  <div className="space-y-2">
                    {data.analyses.map(a => (
                      <div key={a.id} className="bg-white rounded-xl border border-stone-200/60 px-4 py-3 hover:border-[#378ADD]/30 cursor-pointer transition-colors group">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-[#E6F1FB] flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-[#378ADD]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-stone-700 group-hover:text-[#378ADD] transition-colors truncate">{a.title}</p>
                            <p className="text-[10px] text-stone-400">{fmtDate(a.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DB Stats footer */}
              <div className="bg-stone-100/50 rounded-xl border border-stone-200/40 px-4 py-4">
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">Databáza</p>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                  <div className="flex justify-between"><span className="text-stone-400">Emaily</span><span className="font-mono text-stone-600">{data.emailCount.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Dokumenty</span><span className="font-mono text-stone-600">{data.docCount.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Kauzy</span><span className="font-mono text-stone-600">{data.cases.length}</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Úlohy</span><span className="font-mono text-stone-600">{data.tasks.length}</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Pamäť</span><span className="font-mono text-stone-600">{data.memoryCount}</span></div>
                  <div className="flex justify-between"><span className="text-stone-400">Analýzy</span><span className="font-mono text-stone-600">{data.analyses.length}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-8 text-stone-300 text-[10px] tracking-wider">
          OPUS v0.4 — {new Date().getFullYear()} — Opus non fingitur, sed factis demonstratur
        </footer>
      </div>
    </>
  )
}

// ─── Components ──────────────────────────────────────────────
function MetricCard({ label, value, color, sub }) {
  const colorMap = {
    red:   'border-l-[#E24B4A]',
    amber: 'border-l-[#EF9F27]',
    teal:  'border-l-[#1D9E75]',
    blue:  'border-l-[#378ADD]',
  }
  const numColor = {
    red:   'text-[#E24B4A]',
    amber: 'text-[#EF9F27]',
    teal:  'text-[#1D9E75]',
    blue:  'text-[#378ADD]',
  }
  return (
    <div className={`bg-white rounded-xl border border-stone-200/60 border-l-4 ${colorMap[color]} px-4 py-4 sm:px-5 sm:py-5`}>
      <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">{label}</p>
      <p className={`text-3xl sm:text-4xl font-light mt-1 ${numColor[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-stone-400 mt-1">{sub}</p>}
    </div>
  )
}

function CaseCard({ c, tasks }) {
  const openTaskCount = tasks.filter(t => t.status !== 'done').length

  return (
    <div className="bg-white rounded-xl border border-stone-200/60 hover:border-stone-300 transition-colors">
      <div className="px-4 sm:px-5 py-4 sm:py-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-xs font-semibold bg-stone-800 text-white px-2.5 py-1 rounded-lg">{c.code}</span>
            <h3 className="text-sm sm:text-[15px] font-medium text-stone-800">{c.name}</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${priorityStyle[c.priority]}`}>{priorityLabel[c.priority]}</span>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${statusStyle[c.status] || 'bg-stone-100 text-stone-500'}`}>{statusLabel[c.status] || c.status}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs">
          {c.case_number && (
            <div>
              <span className="text-stone-400 block text-[10px]">Sp. zn.</span>
              <span className="text-stone-700 font-mono">{c.case_number}</span>
            </div>
          )}
          {c.court && (
            <div className="sm:col-span-2">
              <span className="text-stone-400 block text-[10px]">Súd</span>
              <span className="text-stone-700">{c.court}</span>
            </div>
          )}
          {c.our_role && (
            <div>
              <span className="text-stone-400 block text-[10px]">Naša rola</span>
              <span className="text-stone-700">{c.our_role}</span>
            </div>
          )}
          {c.opposing_party && (
            <div className="sm:col-span-2">
              <span className="text-stone-400 block text-[10px]">Protistrana</span>
              <span className="text-[#E24B4A] font-medium">{c.opposing_party}</span>
            </div>
          )}
          {c.our_lawyer && (
            <div>
              <span className="text-stone-400 block text-[10px]">Náš právnik</span>
              <span className="text-[#1D9E75] font-medium">{c.our_lawyer}</span>
            </div>
          )}
        </div>
        {/* Case bottom bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
          <div className="flex items-center gap-3 text-[10px] text-stone-400">
            {c.next_deadline && (
              <span className={daysUntil(c.next_deadline) <= 3 ? 'text-[#E24B4A] font-semibold' : ''}>
                Lehota: {fmtDate(c.next_deadline)}
              </span>
            )}
            {c.next_action && <span className="truncate max-w-[200px]">→ {c.next_action}</span>}
          </div>
          {openTaskCount > 0 && (
            <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{openTaskCount} úloh</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── App Root ────────────────────────────────────────────────
export default function Home() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setChecking(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (checking) return <main className="min-h-screen flex items-center justify-center"><p className="text-stone-300 tracking-[0.3em] text-lg">OPUS</p></main>
  if (!user) return <LoginForm />
  return <Dashboard user={user} />
}
