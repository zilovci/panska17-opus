'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase, sc } from '../../components/opus'

export default function KauzyPage() {
  const searchParams = useSearchParams()
  const filterTema = searchParams.get('tema')
  const filterVzorec = searchParams.get('vzorec')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState(null)

  var loadData = useCallback(async function() {
    var [kauzyR, temyR, tkR, vzorceR, kvR, konaniaR, kkR] = await Promise.all([
      supabase.from('kauzy').select('*').order('id'),
      supabase.from('temy').select('*').order('id'),
      supabase.from('tema_kauzy').select('*'),
      supabase.from('vzorce').select('*').order('id'),
      supabase.from('kauza_vzorce').select('*'),
      supabase.from('konania').select('id,code,name,status').order('id'),
      supabase.from('kauza_konania').select('*'),
    ])
    setData({
      kauzy: kauzyR.data || [],
      temy: temyR.data || [],
      temaKauzy: tkR.data || [],
      vzorce: vzorceR.data || [],
      kauzaVzorce: kvR.data || [],
      konania: konaniaR.data || [],
      kauzaKonania: kkR.data || [],
    })
    setLoading(false)
  }, [])

  useEffect(function() { loadData() }, [loadData])

  useEffect(function() {
    if (!data) return
    if (filterTema) {
      var tema = data.temy.find(function(t) { return t.id === parseInt(filterTema) })
      if (tema) setActiveFilter({ type: 'tema', id: tema.id, label: tema.name })
    } else if (filterVzorec) {
      var vzorec = data.vzorce.find(function(v) { return v.id === parseInt(filterVzorec) })
      if (vzorec) setActiveFilter({ type: 'vzorec', id: vzorec.id, label: vzorec.name, color: vzorec.color })
    }
  }, [data, filterTema, filterVzorec])

  if (loading) return <div className="text-center py-20 text-stone-300 text-lg animate-pulse">Načítavam...</div>

  function getFilteredKauzy() {
    if (!activeFilter) return data.kauzy
    if (activeFilter.type === 'tema') {
      var ids = data.temaKauzy.filter(function(tk) { return tk.tema_id === activeFilter.id }).map(function(tk) { return tk.kauza_id })
      return data.kauzy.filter(function(k) { return ids.indexOf(k.id) >= 0 })
    }
    if (activeFilter.type === 'vzorec') {
      var ids2 = data.kauzaVzorce.filter(function(kv) { return kv.vzorec_id === activeFilter.id }).map(function(kv) { return kv.kauza_id })
      return data.kauzy.filter(function(k) { return ids2.indexOf(k.id) >= 0 })
    }
    return data.kauzy
  }

  function getVzorceForKauza(kauzaId) {
    return data.kauzaVzorce
      .filter(function(kv) { return kv.kauza_id === kauzaId })
      .map(function(kv) { return data.vzorce.find(function(v) { return v.id === kv.vzorec_id }) })
      .filter(Boolean)
  }

  function getKonaniaForKauza(kauzaId) {
    var ids = data.kauzaKonania.filter(function(kk) { return kk.kauza_id === kauzaId }).map(function(kk) { return kk.konanie_id })
    return data.konania.filter(function(k) { return ids.indexOf(k.id) >= 0 })
  }

  var filteredKauzy = getFilteredKauzy()

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-stone-800">Kauzy</h1>
          <p className="text-sm text-stone-400 mt-1">{filteredKauzy.length} z {data.kauzy.length}</p>
        </div>
      </div>

      {/* FILTER CHIPS */}
      <div className="flex flex-wrap gap-2">
        <button onClick={function() { setActiveFilter(null) }} className={'text-xs px-3 py-1.5 rounded-full border transition-colors ' + (!activeFilter ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400')}>
          Všetky ({data.kauzy.length})
        </button>
        {data.temy.map(function(t) {
          var cnt = data.temaKauzy.filter(function(tk) { return tk.tema_id === t.id }).length
          var isActive = activeFilter && activeFilter.type === 'tema' && activeFilter.id === t.id
          return (
            <button key={'t' + t.id} onClick={function() { setActiveFilter(isActive ? null : { type: 'tema', id: t.id, label: t.name }) }} className={'text-xs px-3 py-1.5 rounded-full border transition-colors ' + (isActive ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400')}>
              {t.name} ({cnt})
            </button>
          )
        })}
        <div className="w-px bg-stone-200 mx-1" />
        {data.vzorce.map(function(v) {
          var cnt = data.kauzaVzorce.filter(function(kv) { return kv.vzorec_id === v.id }).length
          var isActive = activeFilter && activeFilter.type === 'vzorec' && activeFilter.id === v.id
          return (
            <button key={'v' + v.id} onClick={function() { setActiveFilter(isActive ? null : { type: 'vzorec', id: v.id, label: v.name, color: v.color }) }} className={'text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ' + (isActive ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400')}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.color }} />
              {v.name} ({cnt})
            </button>
          )
        })}
      </div>

      {/* KAUZY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredKauzy.map(function(k) {
          var st = sc(k.priority || k.status)
          var myVzorce = getVzorceForKauza(k.id)
          var myKonania = getKonaniaForKauza(k.id)
          return (
            <Link key={k.id} href={'/kauzy/' + k.id} className="bg-white rounded-2xl border border-stone-100 p-5 hover:shadow-lg hover:border-stone-200 transition-all group">
              <div className="flex items-center gap-2 mb-2">
                {k.code && <span className="text-[10px] font-mono font-bold text-stone-400">{k.code}</span>}
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
              </div>
              <h3 className="text-sm font-semibold text-stone-800 group-hover:text-stone-950 mb-1">{k.name}</h3>
              {k.description && <p className="text-[11px] text-stone-500 leading-relaxed line-clamp-2 mb-3">{k.description}</p>}

              {/* VZORCE chips */}
              {myVzorce.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {myVzorce.map(function(v) {
                    return <span key={v.id} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: v.color }}>{v.name}</span>
                  })}
                </div>
              )}

              {/* KONANIA links */}
              {myKonania.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-stone-50">
                  {myKonania.map(function(kon) {
                    return <span key={kon.id} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-red-700">{kon.code}</span>
                  })}
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {filteredKauzy.length === 0 && (
        <div className="text-center py-16 text-stone-300">
          <div className="text-3xl mb-2">∅</div>
          <div className="text-sm">Žiadne kauzy pre tento filter</div>
        </div>
      )}
    </div>
  )
}
