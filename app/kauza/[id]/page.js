'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function formatDate(d) { return d ? new Date(d).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' }) : '' }
function formatDateTime(d) { return d ? new Date(d).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '' }

var STATUS_COLORS = {
  urgent: { bg: '#FCEBEB', text: '#E24B4A', label: 'Urgentné' },
  high: { bg: '#FAEEDA', text: '#C47F0A', label: 'Vysoká' },
  normal: { bg: '#E1F5EE', text: '#1D9E75', label: 'Normálna' },
  low: { bg: '#E6F1FB', text: '#378ADD', label: 'Nízka' },
  active: { bg: '#E1F5EE', text: '#1D9E75', label: 'Aktívna' },
  resolved: { bg: '#F3F4F6', text: '#9CA3AF', label: 'Vyriešené' },
  monitoring: { bg: '#F3F4F6', text: '#6B7280', label: 'Monitorovanie' },
}
function sc(s) { return STATUS_COLORS[s] || STATUS_COLORS.normal }

function EmailItem({ email }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-stone-100 rounded-xl overflow-hidden">
      <div onClick={function(){setOpen(!open)}} className="p-4 cursor-pointer hover:bg-stone-50 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-stone-800 break-words">{email.subject || '(bez predmetu)'}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-stone-400">
            <span>{email.from_name || email.from_email}</span>
            <span>{formatDateTime(email.date)}</span>
            {email.has_attachments && <span>📎 {email.attachment_count}</span>}
          </div>
        </div>
        <span className="text-stone-300 text-xs mt-1 flex-shrink-0">{open ? '▼' : '▶'}</span>
      </div>
      {open && (
        <div className="border-t border-stone-100 p-4 bg-stone-50">
          <div className="text-[11px] text-stone-400 mb-3 space-y-0.5">
            <div><span className="font-medium">Od:</span> {email.from_name} &lt;{email.from_email}&gt;</div>
            {email.to_addresses && <div className="break-words"><span className="font-medium">Komu:</span> {Array.isArray(email.to_addresses) ? email.to_addresses.join(', ') : email.to_addresses}</div>}
            {email.cc_addresses && email.cc_addresses.length > 0 && <div className="break-words"><span className="font-medium">Kópia:</span> {Array.isArray(email.cc_addresses) ? email.cc_addresses.join(', ') : email.cc_addresses}</div>}
          </div>
          <div className="text-sm text-stone-700 whitespace-pre-wrap break-words max-h-[500px] overflow-y-auto leading-relaxed">{email.text_body || '(prázdny email)'}</div>
        </div>
      )}
    </div>
  )
}

function DocItem({ doc }) {
  return (
    <div className="border border-stone-100 rounded-xl p-4 hover:bg-stone-50 overflow-hidden">
      <div className="flex items-start gap-3">
        <span className="text-[10px] px-1.5 py-0.5 bg-stone-200 rounded text-stone-600 font-mono flex-shrink-0 mt-0.5">{doc.extension}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-stone-800 break-words">{doc.filename}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-stone-400">
            {doc.date && <span>{formatDate(doc.date)}</span>}
            {doc.folder && <span className="truncate max-w-[200px]">{doc.folder}</span>}
            {doc.text_length > 0 && <span>{doc.text_length.toLocaleString()} znakov</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function KauzaPage({ params }) {
  var kauzaId = parseInt(params.id)
  const [kauza, setKauza] = useState(null)
  const [emails, setEmails] = useState([])
  const [documents, setDocuments] = useState([])
  const [konania, setKonania] = useState([])
  const [vzorce, setVzorce] = useState([])
  const [loading, setLoading] = useState(true)
  const [emailCount, setEmailCount] = useState(0)
  const [docCount, setDocCount] = useState(0)
  const [tab, setTab] = useState('emails')
  const [user, setUser] = useState(null)
  const [searchInKauza, setSearchInKauza] = useState('')
  const [emailPage, setEmailPage] = useState(0)
  const [docPage, setDocPage] = useState(0)
  var PAGE_SIZE = 20

  useEffect(function() {
    supabase.auth.getUser().then(function(r) {
      if (!r.data.user) { window.location.href = '/' }
      else { setUser(r.data.user); loadKauza() }
    })
  }, [])

  async function loadKauza() {
    var { data: k } = await supabase.from('kauzy').select('*').eq('id', kauzaId).single()
    if (!k) { setLoading(false); return }
    setKauza(k)

    // Load related konania
    var { data: kkLinks } = await supabase.from('kauza_konania').select('konanie_id').eq('kauza_id', kauzaId)
    if (kkLinks && kkLinks.length > 0) {
      var konanieIds = kkLinks.map(function(l) { return l.konanie_id })
      var { data: kon } = await supabase.from('konania').select('*').in('id', konanieIds)
      setKonania(kon || [])
    }

    // Load vzorce
    var { data: kvLinks } = await supabase.from('kauza_vzorce').select('vzorec_id').eq('kauza_id', kauzaId)
    if (kvLinks && kvLinks.length > 0) {
      var vzIds = kvLinks.map(function(l) { return l.vzorec_id })
      var { data: vz } = await supabase.from('vzorce').select('*').in('id', vzIds)
      setVzorce(vz || [])
    }

    // Search emails by keywords
    if (k.search_keywords && k.search_keywords.length > 0) {
      await searchEmails(k.search_keywords, 0)
      await searchDocs(k.search_keywords, 0)
    }
    setLoading(false)
  }

  async function searchEmails(keywords, page) {
    var { data } = await supabase.rpc('search_emails_by_keywords', {
      keywords: keywords,
      min_matches: keywords.length > 3 ? 2 : 1,
      result_limit: PAGE_SIZE,
      result_offset: page * PAGE_SIZE
    })
    setEmails(data || [])
    setEmailCount(data && data.length > 0 ? Number(data[0].total_count) : 0)
    setEmailPage(page)
  }

  async function searchDocs(keywords, page) {
    var { data } = await supabase.rpc('search_docs_by_keywords', {
      keywords: keywords,
      min_matches: keywords.length > 3 ? 2 : 1,
      result_limit: PAGE_SIZE,
      result_offset: page * PAGE_SIZE
    })
    setDocuments(data || [])
    setDocCount(data && data.length > 0 ? Number(data[0].total_count) : 0)
    setDocPage(page)
  }

  async function handleSearchInKauza() {
    if (!searchInKauza.trim() || !kauza) return
    var combined = kauza.search_keywords ? kauza.search_keywords.concat([searchInKauza.trim()]) : [searchInKauza.trim()]
    await searchEmails(combined, 0)
    await searchDocs(combined, 0)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-3xl font-extralight tracking-wide text-stone-300 animate-pulse">OPUS</div>
    </main>
  )

  if (!kauza) return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-center">
        <div className="text-stone-400 mb-4">Kauza nenájdená</div>
        <Link href="/" className="text-sm text-indigo-600 hover:underline">← Späť na dashboard</Link>
      </div>
    </main>
  )

  var st = sc(kauza.priority || kauza.status)
  var totalEmailPages = Math.ceil(emailCount / PAGE_SIZE)
  var totalDocPages = Math.ceil(docCount / PAGE_SIZE)

  return (
    <main className="min-h-screen bg-stone-50">
      {/* HEADER */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-stone-400 hover:text-stone-600 text-sm">← OPUS</Link>
            <div className="text-[9px] font-mono tracking-wider text-stone-300">KAUZA</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-stone-400">{user && user.email}</div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* KAUZA INFO */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded" style={{backgroundColor: st.bg, color: st.text}}>{st.label}</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{backgroundColor: sc(kauza.status).bg, color: sc(kauza.status).text}}>{sc(kauza.status).label}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-semibold text-stone-800 mb-3">{kauza.name}</h1>
          {kauza.description && <div className="text-sm text-stone-600 leading-relaxed mb-4">{kauza.description}</div>}

          {/* Vzorce */}
          {vzorce.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {vzorce.map(function(v) { return <span key={v.id} className="text-[10px] font-medium px-2 py-1 rounded-full text-white" style={{backgroundColor: v.color}}>{v.name}</span> })}
            </div>
          )}

          {/* Konania */}
          {konania.length > 0 && (
            <div className="border-t border-stone-100 pt-4 mt-4">
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Konania ({konania.length})</div>
              <div className="space-y-2">
                {konania.map(function(k) { var ks = sc(k.status); return (
                  <div key={k.id} className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-red-200 text-red-800">{k.code}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor: ks.bg, color: ks.text}}>{ks.label}</span>
                      {k.case_number && <span className="text-[10px] text-stone-400">sp.zn. {k.case_number}</span>}
                    </div>
                    <div className="text-sm text-stone-700">{k.name}</div>
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>

        {/* SEARCH WITHIN KAUZA */}
        <div className="relative">
          <input type="text" value={searchInKauza} onChange={function(e){setSearchInKauza(e.target.value)}}
            onKeyDown={function(e){ if(e.key==='Enter') handleSearchInKauza() }}
            placeholder="Spresniť vyhľadávanie v tejto kauze..."
            className="w-full px-5 py-3 pl-12 bg-white border border-stone-200 rounded-2xl text-sm focus:outline-none focus:border-stone-400 shadow-sm" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300 text-lg">🔍</span>
          {searchInKauza && <button onClick={function(){setSearchInKauza('');loadKauza()}} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-sm">✕</button>}
        </div>

        {/* TABS */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1">
          <button onClick={function(){setTab('emails')}} className={'flex-1 py-2.5 rounded-lg text-sm font-medium transition ' + (tab === 'emails' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700')}>
            Emaily ({emailCount.toLocaleString()})
          </button>
          <button onClick={function(){setTab('docs')}} className={'flex-1 py-2.5 rounded-lg text-sm font-medium transition ' + (tab === 'docs' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700')}>
            Dokumenty ({docCount.toLocaleString()})
          </button>
        </div>

        {/* CONTENT */}
        {tab === 'emails' && (
          <div className="space-y-3">
            {emails.length === 0 && <div className="text-center py-8 text-stone-300 text-sm">Žiadne emaily</div>}
            {emails.map(function(e) { return <EmailItem key={e.id} email={e} /> })}
            {/* Pagination */}
            {totalEmailPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button disabled={emailPage === 0} onClick={function(){searchEmails(kauza.search_keywords, emailPage - 1)}}
                  className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 disabled:opacity-30 hover:bg-stone-50">← Novšie</button>
                <span className="text-[11px] text-stone-400">{emailPage + 1} / {totalEmailPages}</span>
                <button disabled={emailPage >= totalEmailPages - 1} onClick={function(){searchEmails(kauza.search_keywords, emailPage + 1)}}
                  className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 disabled:opacity-30 hover:bg-stone-50">Staršie →</button>
              </div>
            )}
          </div>
        )}

        {tab === 'docs' && (
          <div className="space-y-3">
            {documents.length === 0 && <div className="text-center py-8 text-stone-300 text-sm">Žiadne dokumenty</div>}
            {documents.map(function(d) { return <DocItem key={d.id} doc={d} /> })}
            {totalDocPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button disabled={docPage === 0} onClick={function(){searchDocs(kauza.search_keywords, docPage - 1)}}
                  className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 disabled:opacity-30 hover:bg-stone-50">← Novšie</button>
                <span className="text-[11px] text-stone-400">{docPage + 1} / {totalDocPages}</span>
                <button disabled={docPage >= totalDocPages - 1} onClick={function(){searchDocs(kauza.search_keywords, docPage + 1)}}
                  className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 disabled:opacity-30 hover:bg-stone-50">Staršie →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
