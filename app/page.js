'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Color system
const STATUS = {
  urgent:     { bg: '#FCEBEB', text: '#E24B4A', label: 'Urgentné' },
  high:       { bg: '#FAEEDA', text: '#C47F0A', label: 'Vysoká' },
  normal:     { bg: '#E1F5EE', text: '#1D9E75', label: 'Normálna' },
  low:        { bg: '#E6F1FB', text: '#378ADD', label: 'Nízka' },
  monitoring: { bg: '#F3F4F6', text: '#6B7280', label: 'Monitorovanie' },
  resolved:   { bg: '#F3F4F6', text: '#9CA3AF', label: 'Vyriešené' },
  done:       { bg: '#F3F4F6', text: '#9CA3AF', label: 'Hotové' },
  open:       { bg: '#FAEEDA', text: '#C47F0A', label: 'Otvorené' },
  in_progress:{ bg: '#E1F5EE', text: '#1D9E75', label: 'Prebieha' },
  active:     { bg: '#E1F5EE', text: '#1D9E75', label: 'Aktívna' },
}

function getStatusStyle(s) {
  return STATUS[s] || STATUS.normal
}

// Helpers
function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isOverdue(d) {
  if (!d) return false
  return new Date(d) < new Date(new Date().toDateString())
}

function isSoon(d) {
  if (!d) return false
  const diff = (new Date(d) - new Date(new Date().toDateString())) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 7
}

// Login
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      if (err.message.includes('Invalid') || err.message.includes('invalid') || err.message.includes('Database')) {
        const { error: signUpErr } = await supabase.auth.signUp({ email, password, options: { data: { full_name: email.split('@')[0] } } })
        if (signUpErr) { setError(signUpErr.message); setLoading(false) }
      } else { setError(err.message); setLoading(false) }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-xs font-mono tracking-[0.3em] text-stone-400 mb-2">PANSKÁ 17</div>
          <h1 className="text-5xl font-extralight tracking-wide text-stone-800">OPUS</h1>
          <p className="text-stone-400 text-sm mt-2">Právny informačný systém</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-[11px] font-medium text-stone-500 mb-1.5 uppercase tracking-wider">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 transition-colors" required />
            </div>
            <div className="mb-6">
              <label className="block text-[11px] font-medium text-stone-500 mb-1.5 uppercase tracking-wider">Heslo</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 transition-colors" required />
            </div>
            {error && <div className="mb-4 text-red-600 text-sm text-center bg-red-50 rounded-lg py-2">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 disabled:opacity-40 transition-colors">
              {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

// Metric Card
function MetricCard({ value, label, color, icon }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-3xl font-light tracking-tight" style={{ color }}>{value}</div>
          <div className="text-[11px] text-stone-400 mt-1 uppercase tracking-wider font-medium">{label}</div>
        </div>
        <div className="text-lg opacity-30">{icon}</div>
      </div>
    </div>
  )
}

// Case Card
function CaseCard({ c, onClick }) {
  const st = getStatusStyle(c.priority)
  const stStatus = getStatusStyle(c.status)
  return (
    <div onClick={onClick}
      className="bg-white rounded-xl border border-stone-100 p-4 hover:shadow-md hover:border-stone-200 transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: st.bg, color: st.text }}>{c.code}</span>
          <span className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: stStatus.bg, color: stStatus.text }}>{stStatus.label}</span>
        </div>
        {c.next_deadline && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            isOverdue(c.next_deadline) ? 'bg-red-100 text-red-600' :
            isSoon(c.next_deadline) ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-500'
          }`}>
            {formatDate(c.next_deadline)}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-stone-800 mb-1.5 group-hover:text-stone-950">{c.name}</h3>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-stone-400">
        {c.case_number && <span>sp.zn. {c.case_number}</span>}
        {c.court && <span>{c.court}</span>}
        {c.our_lawyer && <span className="text-teal-500">{c.our_lawyer}</span>}
      </div>
      {c.opposing_party && (
        <div className="text-[11px] text-red-400 mt-1">vs. {c.opposing_party}</div>
      )}
    </div>
  )
}

// Task Row
function TaskRow({ t, onToggle }) {
  const st = getStatusStyle(t.priority)
  const isDone = t.status === 'done'
  return (
    <div className={`flex items-start gap-3 py-2.5 px-3 rounded-lg group hover:bg-stone-50 transition-colors ${isDone ? 'opacity-50' : ''}`}>
      <button onClick={() => onToggle(t)}
        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
          isDone ? 'bg-stone-300 border-stone-300 text-white' : 'border-stone-300 hover:border-stone-500'
        }`}>
        {isDone && <span className="text-[10px]">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-snug ${isDone ? 'line-through text-stone-400' : 'text-stone-700'}`}>{t.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
          {t.due_date && (
            <span className={`text-[10px] ${isOverdue(t.due_date) ? 'text-red-500 font-medium' : 'text-stone-400'}`}>
              {formatDate(t.due_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Search Bar
function SearchBar({ value, onChange, onSearch, loading }) {
  return (
    <div className="relative">
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSearch()}
        placeholder="Hľadať v emailoch, dokumentoch, kauzách..."
        className="w-full px-5 py-3.5 pl-12 bg-white border border-stone-200 rounded-2xl text-sm focus:outline-none focus:border-stone-400 shadow-sm transition-colors" />
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 text-lg">🔍</span>
      {loading && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 text-xs animate-pulse">Hľadám...</span>}
    </div>
  )
}

// Search Results
function SearchResults({ results, query, onClose }) {
  if (!results) return null
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-stone-700">Výsledky pre &bdquo;{query}&ldquo;</h3>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-sm">✕ Zavrieť</button>
      </div>
      {results.emails.length === 0 && results.documents.length === 0 && results.cases.length === 0 ? (
        <p className="text-stone-400 text-sm">Žiadne výsledky.</p>
      ) : (
        <div className="space-y-4">
          {results.cases.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Kauzy ({results.cases.length})</div>
              {results.cases.map(c => (
                <div key={c.id} className="text-sm py-1.5 text-stone-700">
                  <span className="font-mono text-xs font-bold mr-2" style={{color: getStatusStyle(c.priority).text}}>{c.code}</span>
                  {c.name}
                </div>
              ))}
            </div>
          )}
          {results.emails.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Emaily ({results.emails.length})</div>
              {results.emails.slice(0, 10).map(e => (
                <div key={e.id} className="py-2 border-b border-stone-50 last:border-0">
                  <div className="text-sm text-stone-700 font-medium">{e.subject || '(bez predmetu)'}</div>
                  <div className="text-[11px] text-stone-400 flex gap-3">
                    <span>{e.from_name || e.from_email}</span>
                    <span>{e.date ? new Date(e.date).toLocaleDateString('sk-SK') : ''}</span>
                  </div>
                  {e.text_body && <div className="text-[11px] text-stone-400 mt-0.5 truncate max-w-full">{e.text_body.substring(0, 200)}</div>}
                </div>
              ))}
            </div>
          )}
          {results.documents.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Dokumenty ({results.documents.length})</div>
              {results.documents.slice(0, 10).map(d => (
                <div key={d.id} className="text-sm py-1.5 text-stone-700 flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 rounded text-stone-500 font-mono">{d.extension}</span>
                  {d.filename}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Case Detail Modal
function CaseDetail({ c, onClose, tasks, analyses }) {
  const st = getStatusStyle(c.priority)
  const caseTasks = tasks.filter(t => t.case_id === c.id)
  const caseAnalyses = analyses.filter(a => a.case_id === c.id)

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-stone-100">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-mono font-bold px-2.5 py-1 rounded"
                  style={{ backgroundColor: st.bg, color: st.text }}>{c.code}</span>
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ backgroundColor: getStatusStyle(c.status).bg, color: getStatusStyle(c.status).text }}>
                  {getStatusStyle(c.status).label}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-stone-800">{c.name}</h2>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none p-1">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {c.case_number && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Sp. zn.</span><div className="font-medium text-stone-700 mt-0.5">{c.case_number}</div></div>}
            {c.court && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Súd</span><div className="font-medium text-stone-700 mt-0.5">{c.court}</div></div>}
            {c.our_role && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Naša rola</span><div className="font-medium text-stone-700 mt-0.5">{c.our_role}</div></div>}
            {c.opposing_party && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Protistrana</span><div className="font-medium text-red-500 mt-0.5">{c.opposing_party}</div></div>}
            {c.our_lawyer && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Náš právnik</span><div className="font-medium text-teal-600 mt-0.5">{c.our_lawyer}</div></div>}
            {c.their_lawyer && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Ich právnik</span><div className="font-medium text-stone-700 mt-0.5">{c.their_lawyer}</div></div>}
            {c.filed_date && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Podané</span><div className="font-medium text-stone-700 mt-0.5">{formatDate(c.filed_date)}</div></div>}
            {c.next_deadline && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Lehota</span><div className={`font-medium mt-0.5 ${isOverdue(c.next_deadline) ? 'text-red-500' : 'text-stone-700'}`}>{formatDate(c.next_deadline)}</div></div>}
          </div>

          {c.next_action && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Ďalší krok</span>
              <div className="text-sm text-amber-800 mt-0.5">{c.next_action}</div>
            </div>
          )}

          {c.description && (
            <div>
              <span className="text-stone-400 text-xs uppercase tracking-wider">Popis</span>
              <div className="text-sm text-stone-600 mt-1 whitespace-pre-line">{c.description}</div>
            </div>
          )}

          {c.notes && (
            <div>
              <span className="text-stone-400 text-xs uppercase tracking-wider">Poznámky</span>
              <div className="text-sm text-stone-600 mt-1 whitespace-pre-line">{c.notes}</div>
            </div>
          )}

          {caseTasks.length > 0 && (
            <div>
              <span className="text-stone-400 text-xs uppercase tracking-wider">Úlohy ({caseTasks.length})</span>
              <div className="mt-2 space-y-1">
                {caseTasks.map(t => {
                  const ts = getStatusStyle(t.priority)
                  return (
                    <div key={t.id} className="flex items-center gap-2 text-sm py-1">
                      <span className={`w-2 h-2 rounded-full ${t.status === 'done' ? 'bg-stone-300' : ''}`} style={t.status !== 'done' ? {backgroundColor: ts.text} : {}} />
                      <span className={t.status === 'done' ? 'line-through text-stone-400' : 'text-stone-700'}>{t.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {caseAnalyses.length > 0 && (
            <div>
              <span className="text-stone-400 text-xs uppercase tracking-wider">AI Analýzy ({caseAnalyses.length})</span>
              <div className="mt-2 space-y-2">
                {caseAnalyses.map(a => (
                  <div key={a.id} className="bg-blue-50 border border-blue-100 rounded-xl p-3 cursor-pointer hover:bg-blue-100 transition-colors">
                    <div className="text-sm font-medium text-blue-800">{a.title}</div>
                    <div className="text-[10px] text-blue-500 mt-0.5">{a.analysis_type} &bull; {new Date(a.created_at).toLocaleDateString('sk-SK')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Dashboard
function Dashboard({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedCase, setSelectedCase] = useState(null)

  const loadData = useCallback(async () => {
    const [emailsRes, docsRes, casesRes, tasksRes, analysesRes, timelineRes] = await Promise.all([
      supabase.from('emails').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase.from('cases').select('*').order('id'),
      supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('analyses').select('*').neq('analysis_type', 'dashboard_design'),
      supabase.from('timeline_events').select('*').order('date', { ascending: false }).limit(20),
    ])
    setData({
      emailCount: emailsRes.count || 0,
      docCount: docsRes.count || 0,
      cases: casesRes.data || [],
      tasks: tasksRes.data || [],
      analyses: analysesRes.data || [],
      timeline: timelineRes.data || [],
    })
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    const q = '%' + searchQuery.trim() + '%'
    const [emails, docs, cases] = await Promise.all([
      supabase.from('emails').select('id, subject, from_name, from_email, date, text_body').or('subject.ilike.' + q + ',text_body.ilike.' + q + ',from_name.ilike.' + q).limit(20),
      supabase.from('documents').select('id, filename, extension, date, folder').or('filename.ilike.' + q + ',text_body.ilike.' + q).limit(20),
      supabase.from('cases').select('*').or('name.ilike.' + q + ',description.ilike.' + q + ',opposing_party.ilike.' + q + ',case_number.ilike.' + q + ',code.ilike.' + q),
    ])
    setSearchResults({
      emails: emails.data || [],
      documents: docs.data || [],
      cases: cases.data || [],
    })
    setSearchLoading(false)
  }

  async function toggleTask(task) {
    const newStatus = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null
    }).eq('id', task.id)
    loadData()
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="text-3xl font-extralight tracking-wide text-stone-300 animate-pulse">OPUS</div>
        <div className="text-[11px] text-stone-300 mt-2 tracking-wider">Načítavam...</div>
      </div>
    </main>
  )

  const activeCases = data.cases.filter(c => c.status === 'active')
  const monitoringCases = data.cases.filter(c => c.status === 'monitoring')
  const openTasks = data.tasks.filter(t => t.status !== 'done')
  const doneTasks = data.tasks.filter(t => t.status === 'done')
  const overdueTasks = openTasks.filter(t => t.due_date && isOverdue(t.due_date))
  const upcomingDeadlines = data.cases.filter(c => c.next_deadline && isSoon(c.next_deadline)).length +
    openTasks.filter(t => t.due_date && isSoon(t.due_date)).length

  const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
  const sortedActiveCases = [...activeCases].sort((a, b) => (priorityOrder[a.priority] || 9) - (priorityOrder[b.priority] || 9))

  return (
    <main className="min-h-screen bg-stone-50">
      {/* HEADER */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <div>
              <div className="text-[9px] md:text-[10px] font-mono tracking-[0.3em] text-stone-300">PANSKÁ 17</div>
              <h1 className="text-xl md:text-2xl font-extralight tracking-wide text-stone-800">OPUS</h1>
            </div>
            <div className="hidden md:flex items-center gap-4 pl-6 border-l border-stone-100">
              <div className="text-center">
                <div className="text-lg font-light text-stone-700">{data.cases.length}</div>
                <div className="text-[9px] text-stone-400 uppercase tracking-wider">Konania</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-light text-stone-700">{data.emailCount.toLocaleString()}</div>
                <div className="text-[9px] text-stone-400 uppercase tracking-wider">Emaily</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-light text-stone-700">{data.docCount.toLocaleString()}</div>
                <div className="text-[9px] text-stone-400 uppercase tracking-wider">Dokumenty</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-stone-800 text-white px-3 md:px-4 py-2 rounded-xl text-xs font-medium hover:bg-stone-900 transition-colors flex items-center gap-1.5">
              <span className="text-sm">✦</span> <span className="hidden sm:inline">Opýtať sa </span>Claude
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-stone-400">{user.email}</div>
              <button onClick={() => supabase.auth.signOut()} className="text-[10px] text-stone-300 hover:text-stone-500">Odhlásiť sa</button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* SEARCH */}
        <SearchBar value={searchQuery} onChange={setSearchQuery} onSearch={handleSearch} loading={searchLoading} />
        {searchResults && <SearchResults results={searchResults} query={searchQuery} onClose={() => setSearchResults(null)} />}

        {/* MOBILE COUNTERS */}
        <div className="flex md:hidden justify-around py-3 bg-white rounded-2xl border border-stone-100 shadow-sm">
          <div className="text-center">
            <div className="text-lg font-light text-stone-700">{data.cases.length}</div>
            <div className="text-[8px] text-stone-400 uppercase tracking-wider">Konania</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-light text-stone-700">{data.emailCount.toLocaleString()}</div>
            <div className="text-[8px] text-stone-400 uppercase tracking-wider">Emaily</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-light text-stone-700">{data.docCount.toLocaleString()}</div>
            <div className="text-[8px] text-stone-400 uppercase tracking-wider">Dokumenty</div>
          </div>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <MetricCard value={activeCases.length} label="Aktívne kauzy" color="#1D9E75" icon="⚖" />
          <MetricCard value={upcomingDeadlines} label="Blížiace sa lehoty" color={upcomingDeadlines > 0 ? '#EF9F27' : '#9CA3AF'} icon="⏱" />
          <MetricCard value={openTasks.length} label="Otvorené úlohy" color={overdueTasks.length > 0 ? '#E24B4A' : '#378ADD'} icon="✓" />
          <MetricCard value={overdueTasks.length} label="Po termíne" color={overdueTasks.length > 0 ? '#E24B4A' : '#9CA3AF'} icon="⚠" />
        </div>

        {/* TWO COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Cases */}
            <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="px-5 md:px-6 py-4 border-b border-stone-50 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Aktívne konania</h2>
                <span className="text-[10px] text-stone-400">{activeCases.length} aktívnych</span>
              </div>
              <div className="p-3 md:p-4 grid gap-3">
                {sortedActiveCases.map(c => (
                  <CaseCard key={c.id} c={c} onClick={() => setSelectedCase(c)} />
                ))}
              </div>
            </section>

            {/* Monitoring */}
            {monitoringCases.length > 0 && (
              <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-5 md:px-6 py-4 border-b border-stone-50">
                  <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Monitorovanie</h2>
                </div>
                <div className="p-3 md:p-4 grid gap-3">
                  {monitoringCases.map(c => (
                    <CaseCard key={c.id} c={c} onClick={() => setSelectedCase(c)} />
                  ))}
                </div>
              </section>
            )}

            {/* Timeline */}
            {data.timeline.length > 0 && (
              <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-5 md:px-6 py-4 border-b border-stone-50">
                  <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Časová os</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4 border-l-2 border-stone-100 pl-6">
                    {data.timeline.map(ev => (
                      <div key={ev.id} className="relative">
                        <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-stone-200 border-2 border-white" />
                        <div className="text-[11px] text-stone-400">{formatDate(ev.date)}</div>
                        <div className="text-sm text-stone-700 font-medium">{ev.title}</div>
                        {ev.description && <div className="text-[11px] text-stone-400 mt-0.5">{ev.description}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT 1/3 */}
          <div className="space-y-6">
            {/* Tasks */}
            <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-50 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Úlohy</h2>
                <span className="text-[10px] text-stone-400">{openTasks.length} otvorených</span>
              </div>
              <div className="p-2 max-h-[500px] overflow-y-auto">
                {openTasks.map(t => (
                  <TaskRow key={t.id} t={t} onToggle={toggleTask} />
                ))}
                {doneTasks.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-stone-400 uppercase tracking-wider px-3 py-2 cursor-pointer hover:text-stone-600">
                      Hotové ({doneTasks.length})
                    </summary>
                    {doneTasks.map(t => (
                      <TaskRow key={t.id} t={t} onToggle={toggleTask} />
                    ))}
                  </details>
                )}
              </div>
            </section>

            {/* Analyses */}
            {data.analyses.length > 0 && (
              <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-50">
                  <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">AI Analýzy</h2>
                </div>
                <div className="p-4 space-y-2">
                  {data.analyses.map(a => (
                    <div key={a.id} className="bg-stone-50 rounded-xl p-3 hover:bg-stone-100 cursor-pointer transition-colors">
                      <div className="text-sm font-medium text-stone-700">{a.title}</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {a.analysis_type} &bull; {new Date(a.created_at).toLocaleDateString('sk-SK')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* DB Stats */}
            <div className="bg-stone-100/50 rounded-2xl p-4 text-center space-y-1">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Databáza</div>
              <div className="text-[11px] text-stone-500">
                {data.emailCount.toLocaleString()} emailov &bull; {data.docCount.toLocaleString()} dokumentov &bull; {data.cases.length} kauz &bull; {data.tasks.length} úloh
              </div>
              <div className="text-[10px] text-stone-300 mt-2">OPUS v0.4 &mdash; {new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Case Detail Modal */}
      {selectedCase && (
        <CaseDetail c={selectedCase} onClose={() => setSelectedCase(null)} tasks={data.tasks} analyses={data.analyses} />
      )}
    </main>
  )
}

// App Root
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

  if (checking) return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-3xl font-extralight tracking-wide text-stone-300 animate-pulse">OPUS</div>
    </main>
  )
  if (!user) return <LoginForm />
  return <Dashboard user={user} />
}
