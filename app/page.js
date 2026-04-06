'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Color system
const STATUS_COLORS = {
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
  waiting:    { bg: '#FAEEDA', text: '#C47F0A', label: 'Čaká' },
  appealed:   { bg: '#FAEEDA', text: '#C47F0A', label: 'Odvolanie' },
  planned:    { bg: '#E6F1FB', text: '#378ADD', label: 'Plánované' },
  paused:     { bg: '#F3F4F6', text: '#6B7280', label: 'Pozastavené' },
}

function sc(s) { return STATUS_COLORS[s] || STATUS_COLORS.normal }

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' })
}
function isOverdue(d) { return d && new Date(d) < new Date(new Date().toDateString()) }
function isSoon(d) {
  if (!d) return false
  var diff = (new Date(d) - new Date(new Date().toDateString())) / 86400000
  return diff >= 0 && diff <= 7
}

// ─── LOGIN ──────────────────────────────────────────────────
function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault(); setLoading(true); setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      if (err.message.includes('Invalid') || err.message.includes('invalid') || err.message.includes('Database')) {
        const { error: e2 } = await supabase.auth.signUp({ email, password, options: { data: { full_name: email.split('@')[0] } } })
        if (e2) { setError(e2.message); setLoading(false) }
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
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" required />
            </div>
            <div className="mb-6">
              <label className="block text-[11px] font-medium text-stone-500 mb-1.5 uppercase tracking-wider">Heslo</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" required />
            </div>
            {error && <div className="mb-4 text-red-600 text-sm text-center bg-red-50 rounded-lg py-2">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 disabled:opacity-40">
              {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

// ─── SEARCH BAR ─────────────────────────────────────────────
function SearchBar({ value, onChange, onSearch, loading }) {
  return (
    <div className="relative">
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSearch()}
        placeholder="Hľadať v emailoch, dokumentoch, kauzách..."
        className="w-full px-5 py-3.5 pl-12 bg-white border border-stone-200 rounded-2xl text-sm focus:outline-none focus:border-stone-400 shadow-sm" />
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 text-lg">🔍</span>
      {loading && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 text-xs animate-pulse">Hľadám...</span>}
    </div>
  )
}

// ─── DETAIL MODAL ───────────────────────────────────────────
function DetailModal({ item, type, onClose, relatedKonania, relatedAktivity, tasks }) {
  var st = sc(item.priority || item.status)
  var itemTasks = tasks.filter(function(t) {
    if (type === 'kauza') return t.kauza_id === item.id
    if (type === 'konanie') return t.konanie_id === item.id
    if (type === 'aktivita') return t.aktivita_id === item.id
    return false
  })

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={function(e){e.stopPropagation()}}>
        <div className="p-6 border-b border-stone-100">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{backgroundColor: type === 'kauza' ? '#DBEAFE' : type === 'konanie' ? '#FEE2E2' : '#E0E7FF', 
                          color: type === 'kauza' ? '#1E40AF' : type === 'konanie' ? '#991B1B' : '#3730A3'}}>
                  {type === 'kauza' ? 'Kauza' : type === 'konanie' ? 'Konanie' : 'Aktivita'}
                </span>
                <span className="text-sm font-mono font-bold px-2 py-0.5 rounded"
                  style={{backgroundColor: st.bg, color: st.text}}>{item.code || ''}</span>
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{backgroundColor: sc(item.status).bg, color: sc(item.status).text}}>{sc(item.status).label}</span>
              </div>
              <h2 className="text-xl font-semibold text-stone-800">{item.name}</h2>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl p-1">✕</button>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* Konanie-specific fields */}
          {type === 'konanie' && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {item.case_number && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Sp. zn.</span><div className="font-medium text-stone-700 mt-0.5">{item.case_number}</div></div>}
              {item.court && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Súd</span><div className="font-medium text-stone-700 mt-0.5">{item.court}</div></div>}
              {item.our_role && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Naša rola</span><div className="font-medium text-stone-700 mt-0.5">{item.our_role}</div></div>}
              {item.opposing_party && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Protistrana</span><div className="font-medium text-red-500 mt-0.5">{item.opposing_party}</div></div>}
              {item.our_lawyer && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Náš právnik</span><div className="font-medium mt-0.5" style={{color:'#1D9E75'}}>{item.our_lawyer}</div></div>}
              {item.their_lawyer && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Ich právnik</span><div className="font-medium text-red-400 mt-0.5">{item.their_lawyer}</div></div>}
              {item.next_deadline && <div><span className="text-stone-400 text-xs uppercase tracking-wider">Lehota</span><div className={'font-medium mt-0.5 ' + (isOverdue(item.next_deadline) ? 'text-red-500' : 'text-stone-700')}>{formatDate(item.next_deadline)}</div></div>}
            </div>
          )}

          {/* Goal - for kauzy */}
          {item.goal && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Cieľ</span>
              <div className="text-sm text-blue-800 mt-0.5">{item.goal}</div>
            </div>
          )}

          {item.description && (
            <div><span className="text-stone-400 text-xs uppercase tracking-wider">Popis</span>
            <div className="text-sm text-stone-600 mt-1 whitespace-pre-line">{item.description}</div></div>
          )}

          {/* AI Summary */}
          {item.ai_summary && (
            <div className="bg-stone-50 border border-stone-100 rounded-xl p-4">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">✦ Claude zhrnutie</span>
              <div className="text-sm text-stone-600 mt-1 whitespace-pre-line">{item.ai_summary}</div>
            </div>
          )}

          {/* User Notes */}
          {item.user_notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Moje poznámky</span>
              <div className="text-sm text-amber-800 mt-1 whitespace-pre-line">{item.user_notes}</div>
            </div>
          )}

          {/* Related konania (for kauzy) */}
          {relatedKonania && relatedKonania.length > 0 && (
            <div><span className="text-stone-400 text-xs uppercase tracking-wider">Konania ({relatedKonania.length})</span>
            <div className="mt-2 space-y-2">
              {relatedKonania.map(function(k) { return (
                <div key={k.id} className="flex items-center gap-2 text-sm bg-red-50 rounded-lg px-3 py-2">
                  <span className="font-mono font-bold text-red-600">{k.code}</span>
                  <span className="text-stone-700">{k.name}</span>
                  <span className="text-[10px] text-stone-400 ml-auto">{k.our_role}</span>
                </div>
              )})}
            </div></div>
          )}

          {/* Tasks */}
          {itemTasks.length > 0 && (
            <div><span className="text-stone-400 text-xs uppercase tracking-wider">Úlohy ({itemTasks.length})</span>
            <div className="mt-2 space-y-1">
              {itemTasks.map(function(t) { var ts = sc(t.priority); return (
                <div key={t.id} className="flex items-center gap-2 text-sm py-1">
                  <span className={'w-2 h-2 rounded-full ' + (t.status === 'done' ? 'bg-stone-300' : '')} style={t.status !== 'done' ? {backgroundColor: ts.text} : {}} />
                  <span className={t.status === 'done' ? 'line-through text-stone-400' : 'text-stone-700'}>{t.title}</span>
                </div>
              )})}
            </div></div>
          )}

          {item.next_action && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Ďalší krok</span>
              <div className="text-sm text-amber-800 mt-0.5">{item.next_action}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TASK ROW ───────────────────────────────────────────────
function TaskRow({ t, onToggle }) {
  var st = sc(t.priority)
  var isDone = t.status === 'done'
  return (
    <div className={'flex items-start gap-3 py-2.5 px-3 rounded-lg group hover:bg-stone-50 ' + (isDone ? 'opacity-50' : '')}>
      <button onClick={function(){onToggle(t)}}
        className={'mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ' +
          (isDone ? 'bg-stone-300 border-stone-300 text-white' : 'border-stone-300 hover:border-stone-500')}>
        {isDone && <span className="text-[10px]">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <div className={'text-sm leading-snug ' + (isDone ? 'line-through text-stone-400' : 'text-stone-700')}>{t.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{backgroundColor: st.bg, color: st.text}}>{st.label}</span>
          {t.due_date && <span className={'text-[10px] ' + (isOverdue(t.due_date) ? 'text-red-500 font-medium' : 'text-stone-400')}>{formatDate(t.due_date)}</span>}
          {t.source_type && t.source_type !== 'manual' && <span className="text-[9px] text-stone-300">{t.source_type}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── DASHBOARD ──────────────────────────────────────────────
function Dashboard({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selected, setSelected] = useState(null) // {item, type}

  const loadData = useCallback(async function() {
    var [emailsR, docsR, temyR, kauzyR, konaniaR, aktivityR, tasksR, strategiaR, kkR, kaR] = await Promise.all([
      supabase.from('emails').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase.from('temy').select('*').order('id'),
      supabase.from('kauzy').select('*').order('priority'),
      supabase.from('konania').select('*').order('id'),
      supabase.from('aktivity').select('*').order('priority'),
      supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('strategia').select('*').limit(1),
      supabase.from('kauza_konania').select('*'),
      supabase.from('kauza_aktivity').select('*'),
    ])
    setData({
      emailCount: emailsR.count || 0,
      docCount: docsR.count || 0,
      temy: temyR.data || [],
      kauzy: kauzyR.data || [],
      konania: konaniaR.data || [],
      aktivity: aktivityR.data || [],
      tasks: tasksR.data || [],
      strategia: (strategiaR.data || [])[0] || null,
      kauza_konania: kkR.data || [],
      kauza_aktivity: kaR.data || [],
    })
    setLoading(false)
  }, [])

  useEffect(function() { loadData() }, [loadData])

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    var q = '%' + searchQuery.trim() + '%'
    var [emails, docs] = await Promise.all([
      supabase.from('emails').select('id, subject, from_name, from_email, date, text_body').or('subject.ilike.' + q + ',text_body.ilike.' + q + ',from_name.ilike.' + q).limit(20),
      supabase.from('documents').select('id, filename, extension, date, folder').or('filename.ilike.' + q + ',text_body.ilike.' + q).limit(20),
    ])
    setSearchResults({ emails: emails.data || [], documents: docs.data || [] })
    setSearchLoading(false)
  }

  async function toggleTask(task) {
    var newStatus = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }).eq('id', task.id)
    loadData()
  }

  function getKonaniaForKauza(kauzaId) {
    var ids = data.kauza_konania.filter(function(kk) { return kk.kauza_id === kauzaId }).map(function(kk) { return kk.konanie_id })
    return data.konania.filter(function(k) { return ids.indexOf(k.id) >= 0 })
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="text-3xl font-extralight tracking-wide text-stone-300 animate-pulse">OPUS</div>
        <div className="text-[11px] text-stone-300 mt-2 tracking-wider">Načítavam...</div>
      </div>
    </main>
  )

  var activeKauzy = data.kauzy.filter(function(k) { return k.status === 'active' })
  var activeKonania = data.konania.filter(function(k) { return k.status === 'active' || k.status === 'waiting' || k.status === 'appealed' })
  var monitoringKonania = data.konania.filter(function(k) { return k.status === 'monitoring' })
  var activeAktivity = data.aktivity.filter(function(a) { return a.status === 'active' || a.status === 'planned' })
  var openTasks = data.tasks.filter(function(t) { return t.status !== 'done' })
  var doneTasks = data.tasks.filter(function(t) { return t.status === 'done' })
  var overdueTasks = openTasks.filter(function(t) { return t.due_date && isOverdue(t.due_date) })
  var upcomingDeadlines = data.konania.filter(function(k) { return k.next_deadline && isSoon(k.next_deadline) }).length +
    openTasks.filter(function(t) { return t.due_date && isSoon(t.due_date) }).length

  var priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }

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
              <div className="text-center"><div className="text-lg font-light text-stone-700">{data.temy.length}</div><div className="text-[9px] text-stone-400 uppercase tracking-wider">Tém</div></div>
              <div className="text-center"><div className="text-lg font-light text-stone-700">{data.konania.length}</div><div className="text-[9px] text-stone-400 uppercase tracking-wider">Konaní</div></div>
              <div className="text-center"><div className="text-lg font-light text-stone-700">{data.emailCount.toLocaleString()}</div><div className="text-[9px] text-stone-400 uppercase tracking-wider">Emailov</div></div>
              <div className="text-center"><div className="text-lg font-light text-stone-700">{data.docCount.toLocaleString()}</div><div className="text-[9px] text-stone-400 uppercase tracking-wider">Dokumentov</div></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-stone-800 text-white px-3 md:px-4 py-2 rounded-xl text-xs font-medium hover:bg-stone-900 flex items-center gap-1.5">
              <span className="text-sm">✦</span> <span className="hidden sm:inline">Opýtať sa </span>Claude
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-stone-400">{user.email}</div>
              <button onClick={function(){supabase.auth.signOut()}} className="text-[10px] text-stone-300 hover:text-stone-500">Odhlásiť sa</button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* STRATEGIA */}
        {data.strategia && (
          <div className="bg-gradient-to-r from-stone-800 to-stone-700 rounded-2xl p-5 text-white shadow-lg">
            <div className="text-[10px] uppercase tracking-wider text-stone-300 mb-1">Stratégia</div>
            <div className="text-lg font-light">{data.strategia.name}</div>
            {data.strategia.goal && <div className="text-sm text-stone-300 mt-2 leading-relaxed">{data.strategia.goal}</div>}
          </div>
        )}

        {/* SEARCH */}
        <SearchBar value={searchQuery} onChange={setSearchQuery} onSearch={handleSearch} loading={searchLoading} />
        {searchResults && (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-stone-700">Výsledky pre &bdquo;{searchQuery}&ldquo;</h3>
              <button onClick={function(){setSearchResults(null)}} className="text-stone-400 hover:text-stone-600 text-sm">✕</button>
            </div>
            {searchResults.emails.length === 0 && searchResults.documents.length === 0 ? (
              <p className="text-stone-400 text-sm">Žiadne výsledky.</p>
            ) : (<div className="space-y-4">
              {searchResults.emails.length > 0 && (<div>
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Emaily ({searchResults.emails.length})</div>
                {searchResults.emails.slice(0, 10).map(function(e) { return (
                  <div key={e.id} className="py-2 border-b border-stone-50 last:border-0">
                    <div className="text-sm text-stone-700 font-medium">{e.subject || '(bez predmetu)'}</div>
                    <div className="text-[11px] text-stone-400 flex gap-3"><span>{e.from_name || e.from_email}</span><span>{e.date ? new Date(e.date).toLocaleDateString('sk-SK') : ''}</span></div>
                  </div>
                )})}
              </div>)}
              {searchResults.documents.length > 0 && (<div>
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Dokumenty ({searchResults.documents.length})</div>
                {searchResults.documents.slice(0, 10).map(function(d) { return (
                  <div key={d.id} className="text-sm py-1.5 text-stone-700 flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 rounded text-stone-500 font-mono">{d.extension}</span>{d.filename}
                  </div>
                )})}
              </div>)}
            </div>)}
          </div>
        )}

        {/* MOBILE COUNTERS */}
        <div className="flex md:hidden justify-around py-3 bg-white rounded-2xl border border-stone-100 shadow-sm">
          <div className="text-center"><div className="text-lg font-light text-stone-700">{data.temy.length}</div><div className="text-[8px] text-stone-400 uppercase tracking-wider">Tém</div></div>
          <div className="text-center"><div className="text-lg font-light text-stone-700">{data.konania.length}</div><div className="text-[8px] text-stone-400 uppercase tracking-wider">Konaní</div></div>
          <div className="text-center"><div className="text-lg font-light text-stone-700">{data.emailCount.toLocaleString()}</div><div className="text-[8px] text-stone-400 uppercase tracking-wider">Emailov</div></div>
          <div className="text-center"><div className="text-lg font-light text-stone-700">{data.docCount.toLocaleString()}</div><div className="text-[8px] text-stone-400 uppercase tracking-wider">Dokumentov</div></div>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm"><div className="text-3xl font-light tracking-tight" style={{color:'#1E40AF'}}>{data.temy.length}</div><div className="text-[11px] text-stone-400 mt-1 uppercase tracking-wider font-medium">Témy</div></div>
          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm"><div className="text-3xl font-light tracking-tight" style={{color: activeKonania.length > 0 ? '#991B1B' : '#9CA3AF'}}>{activeKonania.length}</div><div className="text-[11px] text-stone-400 mt-1 uppercase tracking-wider font-medium">Aktívne konania</div></div>
          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm"><div className="text-3xl font-light tracking-tight" style={{color: overdueTasks.length > 0 ? '#E24B4A' : '#378ADD'}}>{openTasks.length}</div><div className="text-[11px] text-stone-400 mt-1 uppercase tracking-wider font-medium">Otvorené úlohy</div></div>
          <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm"><div className="text-3xl font-light tracking-tight" style={{color: overdueTasks.length > 0 ? '#E24B4A' : '#9CA3AF'}}>{overdueTasks.length}</div><div className="text-[11px] text-stone-400 mt-1 uppercase tracking-wider font-medium">Po termíne</div></div>
        </div>

        {/* TWO COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2/3 */}
          <div className="lg:col-span-2 space-y-6">

            {/* TÉMY */}
            <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="px-5 md:px-6 py-4 border-b border-stone-50">
                <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Témy</h2>
              </div>
              <div className="p-3 md:p-4 grid gap-3">
                {data.temy.map(function(tema) {
                  return (
                    <div key={tema.id} className="bg-white rounded-xl border border-stone-100 p-4 hover:shadow-md hover:border-stone-200 cursor-pointer group overflow-hidden">
                      <h3 className="text-sm font-semibold text-stone-800 group-hover:text-stone-950 break-words">{tema.name}</h3>
                      {tema.description && <div className="text-[11px] text-stone-400 mt-1 line-clamp-2 break-words">{tema.description}</div>}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* KONANIA */}
            <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="px-5 md:px-6 py-4 border-b border-stone-50 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-red-800 uppercase tracking-wider">Konania</h2>
                <span className="text-[10px] text-stone-400">{activeKonania.length} aktívnych</span>
              </div>
              <div className="p-3 md:p-4 grid gap-3">
                {data.konania.map(function(k) {
                  var st = sc(k.status)
                  return (
                    <div key={k.id} onClick={function(){setSelected({item:k, type:'konanie'})}}
                      className="bg-white rounded-xl border border-stone-100 p-4 hover:shadow-md hover:border-stone-200 cursor-pointer group">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">{k.code}</span>
                          <span className="text-xs px-2 py-0.5 rounded" style={{backgroundColor: st.bg, color: st.text}}>{st.label}</span>
                          <span className="text-[10px] text-stone-400">{k.our_role}</span>
                        </div>
                        {k.next_deadline && (
                          <span className={'text-[10px] font-medium px-2 py-0.5 rounded-full ' + (isOverdue(k.next_deadline) ? 'bg-red-100 text-red-600' : isSoon(k.next_deadline) ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-500')}>
                            {formatDate(k.next_deadline)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-stone-800 mb-1 group-hover:text-stone-950">{k.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-stone-400">
                        {k.case_number && <span>sp.zn. {k.case_number}</span>}
                        {k.court && <span>{k.court}</span>}
                      </div>
                      <div className="flex gap-4 mt-1 text-[11px]">
                        {k.our_lawyer && <span style={{color:'#1D9E75'}}>→ {k.our_lawyer}</span>}
                        {k.their_lawyer && <span className="text-red-400">vs. {k.their_lawyer}</span>}
                      </div>
                      {k.opposing_party && <div className="text-[11px] text-red-400 mt-0.5">Protistrana: {k.opposing_party}</div>}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* AKTIVITY */}
            {activeAktivity.length > 0 && (
              <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-5 md:px-6 py-4 border-b border-stone-50 flex justify-between items-center">
                  <h2 className="text-sm font-semibold text-indigo-800 uppercase tracking-wider">Aktivity</h2>
                  <span className="text-[10px] text-stone-400">{activeAktivity.length} aktívnych</span>
                </div>
                <div className="p-3 md:p-4 grid gap-3">
                  {data.aktivity.map(function(a) { return (
                    <div key={a.id} onClick={function(){setSelected({item:a, type:'aktivita'})}}
                      className="bg-white rounded-xl border border-stone-100 p-4 hover:shadow-md hover:border-stone-200 cursor-pointer group overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">Aktivita</span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{backgroundColor: sc(a.status).bg, color: sc(a.status).text}}>{sc(a.status).label}</span>
                        {a.is_recurring && <span className="text-[9px] text-stone-400">🔄 opakovaná</span>}
                      </div>
                      <h3 className="text-sm font-semibold text-stone-800 group-hover:text-stone-950 break-words">{a.name}</h3>
                      {a.description && <div className="text-[11px] text-stone-400 mt-0.5 line-clamp-2 break-words">{a.description}</div>}
                    </div>
                  )})}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT 1/3 */}
          <div className="space-y-6">
            {/* TASKS */}
            <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-50 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Úlohy</h2>
                <span className="text-[10px] text-stone-400">{openTasks.length} otvorených</span>
              </div>
              <div className="p-2 max-h-[500px] overflow-y-auto">
                {openTasks.map(function(t) { return <TaskRow key={t.id} t={t} onToggle={toggleTask} /> })}
                {doneTasks.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-stone-400 uppercase tracking-wider px-3 py-2 cursor-pointer hover:text-stone-600">Hotové ({doneTasks.length})</summary>
                    {doneTasks.map(function(t) { return <TaskRow key={t.id} t={t} onToggle={toggleTask} /> })}
                  </details>
                )}
              </div>
            </section>

            {/* DB STATS */}
            <div className="bg-stone-100/50 rounded-2xl p-4 text-center space-y-1">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Databáza</div>
              <div className="text-[11px] text-stone-500">
                {data.emailCount.toLocaleString()} emailov &bull; {data.docCount.toLocaleString()} dokumentov
              </div>
              <div className="text-[11px] text-stone-500">
                {data.temy.length} tém &bull; {data.konania.length} konaní &bull; {data.aktivity.length} aktivít &bull; {data.tasks.length} úloh
              </div>
              <div className="text-[10px] text-stone-300 mt-2">OPUS v0.7 &mdash; {new Date().getFullYear()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selected && (
        <DetailModal
          item={selected.item}
          type={selected.type}
          onClose={function(){setSelected(null)}}
          relatedKonania={selected.type === 'kauza' ? getKonaniaForKauza(selected.item.id) : []}
          relatedAktivity={[]}
          tasks={data.tasks}
        />
      )}
    </main>
  )
}

// ─── APP ROOT ───────────────────────────────────────────────
export default function Home() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(function() {
    supabase.auth.getUser().then(function(r) { setUser(r.data.user); setChecking(false) })
    var sub = supabase.auth.onAuthStateChange(function(ev, session) { setUser(session ? session.user : null) })
    return function() { sub.data.subscription.unsubscribe() }
  }, [])

  if (checking) return <main className="min-h-screen flex items-center justify-center bg-stone-50"><div className="text-3xl font-extralight tracking-wide text-stone-300 animate-pulse">OPUS</div></main>
  if (!user) return <LoginForm />
  return <Dashboard user={user} />
}
