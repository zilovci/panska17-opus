'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase, sc, formatDate, isOverdue, isSoon } from '../components/opus'

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  var loadData = useCallback(async function() {
    var [emailsR, docsR, temyR, kauzyR, konaniaR, tasksR, strategiaR, tkR, vzorceR, kvR] = await Promise.all([
      supabase.from('emails').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase.from('temy').select('*').order('id'),
      supabase.from('kauzy').select('*').order('id'),
      supabase.from('konania').select('*').order('id'),
      supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('strategia').select('*').limit(1),
      supabase.from('tema_kauzy').select('*'),
      supabase.from('vzorce').select('*').order('id'),
      supabase.from('kauza_vzorce').select('*'),
    ])
    setData({
      emailCount: emailsR.count || 0,
      docCount: docsR.count || 0,
      temy: temyR.data || [],
      kauzy: kauzyR.data || [],
      konania: konaniaR.data || [],
      tasks: tasksR.data || [],
      strategia: (strategiaR.data || [])[0] || null,
      temaKauzy: tkR.data || [],
      vzorce: vzorceR.data || [],
      kauzaVzorce: kvR.data || [],
    })
    setLoading(false)
  }, [])

  useEffect(function() { loadData() }, [loadData])

  async function toggleTask(task) {
    var ns = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({ status: ns, completed_at: ns === 'done' ? new Date().toISOString() : null }).eq('id', task.id)
    loadData()
  }

  if (loading) return <div className="text-center py-20 text-stone-300 text-lg animate-pulse">Načítavam...</div>

  var activeKonania = data.konania.filter(function(k) { return k.status === 'active' || k.status === 'waiting' || k.status === 'appealed' })
  var openTasks = data.tasks.filter(function(t) { return t.status !== 'done' })
  var overdueTasks = openTasks.filter(function(t) { return t.due_date && isOverdue(t.due_date) })

  function getKauzyForTema(temaId) {
    var ids = data.temaKauzy.filter(function(tk) { return tk.tema_id === temaId }).map(function(tk) { return tk.kauza_id })
    return data.kauzy.filter(function(k) { return ids.indexOf(k.id) >= 0 })
  }

  function getKauzyForVzorec(vzId) {
    var ids = data.kauzaVzorce.filter(function(kv) { return kv.vzorec_id === vzId }).map(function(kv) { return kv.kauza_id })
    return data.kauzy.filter(function(k) { return ids.indexOf(k.id) >= 0 })
  }

  return (
    <div className="space-y-6 md:space-y-8">

      {/* STRATEGIA */}
      {data.strategia && (
        <div className="bg-gradient-to-r from-stone-800 to-stone-700 rounded-2xl p-5 text-white shadow-lg">
          <div className="text-[10px] uppercase tracking-wider text-stone-300 mb-1">Stratégia</div>
          <div className="text-lg font-light">{data.strategia.name}</div>
          {data.strategia.goal && <div className="text-sm text-stone-300 mt-2 leading-relaxed">{data.strategia.goal}</div>}
        </div>
      )}

      {/* METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <div className="text-3xl font-light tracking-tight text-indigo-600">{data.kauzy.length}</div>
          <div className="text-[11px] text-stone-400 mt-1 uppercase tracking-wider font-medium">Kauz</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <div className="text-3xl font-light tracking-tight" style={{ color: activeKonania.length > 0 ? '#991B1B' : '#9CA3AF' }}>{activeKonania.length}</div>
          <div className="text-[11px] text-stone-400 mt-1 uppercase tracking-wider font-medium">Aktívne konania</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <div className="text-3xl font-light tracking-tight" style={{ color: overdueTasks.length > 0 ? '#E24B4A' : '#378ADD' }}>{openTasks.length}</div>
          <div className="text-[11px] text-stone-400 mt-1 uppercase tracking-wider font-medium">Otvorené úlohy</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
          <div className="text-3xl font-light tracking-tight" style={{ color: overdueTasks.length > 0 ? '#E24B4A' : '#9CA3AF' }}>{overdueTasks.length}</div>
          <div className="text-[11px] text-stone-400 mt-1 uppercase tracking-wider font-medium">Po termíne</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* TÉMY */}
          <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-stone-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Podľa témy</h2>
              <Link href="/kauzy" className="text-[10px] text-stone-400 hover:text-stone-600">Všetky kauzy →</Link>
            </div>
            <div className="p-3 md:p-4 grid gap-2">
              {data.temy.map(function(tema) {
                var kc = getKauzyForTema(tema.id).length
                return (
                  <Link key={tema.id} href={'/kauzy?tema=' + tema.id} className="bg-white rounded-xl border border-stone-100 px-4 py-3 hover:shadow-md hover:border-stone-200 group flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-stone-800 group-hover:text-stone-950">{tema.name}</h3>
                    <span className="text-[11px] text-stone-400 ml-3">{kc} kauz</span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* VZORCE */}
          <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-stone-50">
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Podľa správania</h2>
            </div>
            <div className="p-3 md:p-4 grid gap-2">
              {data.vzorce.map(function(v) {
                var kc = getKauzyForVzorec(v.id).length
                return (
                  <Link key={v.id} href={'/kauzy?vzorec=' + v.id} className="bg-white rounded-xl border border-stone-100 px-4 py-3 hover:shadow-md hover:border-stone-200 group flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: v.color }} />
                      <h3 className="text-sm font-semibold text-stone-800 group-hover:text-stone-950">{v.name}</h3>
                    </div>
                    <span className="text-[11px] text-stone-400 ml-3">{kc} kauz</span>
                  </Link>
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
                  <div key={k.id} className="bg-white rounded-xl border border-stone-100 p-4 overflow-hidden">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">{k.code}</span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                        <span className="text-[10px] text-stone-400">{k.our_role}</span>
                      </div>
                      {k.next_deadline && (
                        <span className={'text-[10px] font-medium px-2 py-0.5 rounded-full ' + (isOverdue(k.next_deadline) ? 'bg-red-100 text-red-600' : isSoon(k.next_deadline) ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-500')}>
                          {formatDate(k.next_deadline)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-stone-800 mb-1">{k.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-stone-400">
                      {k.case_number && <span>sp.zn. {k.case_number}</span>}
                      {k.court && <span>{k.court}</span>}
                    </div>
                    <div className="flex gap-4 mt-1 text-[11px]">
                      {k.our_lawyer && <span style={{ color: '#1D9E75' }}>→ {k.our_lawyer}</span>}
                      {k.their_lawyer && <span className="text-red-400">vs. {k.their_lawyer}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

        </div>

        {/* SIDEBAR */}
        <div className="space-y-6">

          {/* URGENT TASKS */}
          <section className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-50 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">Úlohy</h2>
              <Link href="/tasky" className="text-[10px] text-stone-400 hover:text-stone-600">{openTasks.length} otvorených →</Link>
            </div>
            <div className="p-2 max-h-[500px] overflow-y-auto">
              {openTasks.slice(0, 10).map(function(t) {
                var st = sc(t.priority)
                var isDone = t.status === 'done'
                return (
                  <Link key={t.id} href={'/tasky?id=' + t.id} className={'flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-stone-50 group ' + (isDone ? 'opacity-50' : '')}>
                    <button onClick={function(e) { e.preventDefault(); e.stopPropagation(); toggleTask(t) }} className={'mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ' + (isDone ? 'bg-stone-300 border-stone-300 text-white' : 'border-stone-300 hover:border-stone-500')}>
                      {isDone && <span className="text-[10px]">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-snug text-stone-700 group-hover:text-stone-900">{t.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                        {t.due_date && <span className={'text-[10px] ' + (isOverdue(t.due_date) ? 'text-red-500 font-medium' : isSoon(t.due_date) ? 'text-amber-500 font-medium' : 'text-stone-400')}>{formatDate(t.due_date)}</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
              {openTasks.length > 10 && (
                <Link href="/tasky" className="block text-center py-3 text-[11px] text-stone-400 hover:text-stone-600">
                  + ďalších {openTasks.length - 10} úloh
                </Link>
              )}
            </div>
          </section>

          {/* DB STATS */}
          <div className="bg-stone-100/50 rounded-2xl p-4 text-center space-y-1">
            <div className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Databáza</div>
            <div className="text-[11px] text-stone-500">{data.emailCount.toLocaleString()} emailov &bull; {data.docCount.toLocaleString()} dokumentov</div>
            <div className="text-[11px] text-stone-500">{data.temy.length} tém &bull; {data.kauzy.length} kauz &bull; {data.konania.length} konaní</div>
          </div>
        </div>
      </div>
    </div>
  )
}
