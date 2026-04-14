'use client'

import { useState } from 'react'
import { supabase, formatDate, formatDateTime } from '../../components/opus'

export default function HladaniePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedEmail, setExpandedEmail] = useState(null)
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [docText, setDocText] = useState({})

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setExpandedEmail(null)
    setExpandedDoc(null)

    var q = '%' + query.trim() + '%'

    var [emailsR, attachR, docsR] = await Promise.all([
      supabase.from('emails')
        .select('id,subject,from_name,from_email,to_addresses,cc_addresses,date,text_body,has_attachments,attachment_count')
        .or('subject.ilike.' + q + ',text_body.ilike.' + q + ',from_name.ilike.' + q)
        .order('date', { ascending: false })
        .limit(30),
      supabase.from('email_attachments')
        .select('id,email_id,filename,extracted_text,text_length')
        .ilike('extracted_text', q)
        .limit(20),
      supabase.from('documents')
        .select('id,filename,extension,date,folder,text_length')
        .or('filename.ilike.' + q + ',text_body.ilike.' + q)
        .order('date', { ascending: false, nullsFirst: false })
        .limit(30),
    ])

    // For attachment results, fetch their parent emails
    var attachData = attachR.data || []
    var parentEmails = {}
    if (attachData.length > 0) {
      var emailIds = [...new Set(attachData.map(function(a) { return a.email_id }))]
      var { data: parents } = await supabase.from('emails')
        .select('id,subject,from_name,date')
        .in('id', emailIds)
      if (parents) {
        parents.forEach(function(p) { parentEmails[p.id] = p })
      }
    }

    setResults({
      emails: emailsR.data || [],
      attachments: attachData.map(function(a) { return Object.assign({}, a, { parentEmail: parentEmails[a.email_id] || null }) }),
      documents: docsR.data || [],
    })
    setLoading(false)
  }

  async function loadDocText(docId) {
    if (docText[docId] !== undefined) return
    var { data } = await supabase.from('documents').select('text_body').eq('id', docId).single()
    setDocText(function(prev) { var next = Object.assign({}, prev); next[docId] = data ? data.text_body : ''; return next })
  }

  var total = results ? results.emails.length + results.attachments.length + results.documents.length : 0

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-light text-stone-800">Hľadanie</h1>
        <p className="text-sm text-stone-400 mt-1">Fulltextové vyhľadávanie naprieč emailmi, prílohami a dokumentmi</p>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={function(e) { setQuery(e.target.value) }}
          onKeyDown={function(e) { if (e.key === 'Enter') handleSearch() }}
          placeholder="Hľadať... (email, príloha, dokument)"
          className="w-full px-5 py-4 pl-14 bg-white border border-stone-200 rounded-2xl text-base focus:outline-none focus:border-stone-400 shadow-sm"
          autoFocus
        />
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-stone-300 text-xl">⌕</span>
        {query && (
          <button onClick={function() { setQuery(''); setResults(null) }} className="absolute right-14 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">✕</button>
        )}
        <button onClick={handleSearch} disabled={loading || !query.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 bg-stone-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-900 disabled:opacity-40">
          {loading ? '...' : 'Hľadať'}
        </button>
      </div>

      {/* RESULTS */}
      {results && (
        <div className="space-y-6">
          <div className="text-sm text-stone-500">
            Nájdených {total} výsledkov pre <span className="font-medium text-stone-700">&bdquo;{query}&ldquo;</span>
          </div>

          {/* EMAILS */}
          {results.emails.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">Emaily ({results.emails.length})</h2>
              <div className="space-y-2">
                {results.emails.map(function(e) {
                  var isOpen = expandedEmail === e.id
                  return (
                    <div key={e.id} className="bg-white rounded-xl border border-stone-100 overflow-hidden">
                      <div onClick={function() { setExpandedEmail(isOpen ? null : e.id) }} className="p-4 cursor-pointer hover:bg-stone-50 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-800 break-words">{e.subject || '(bez predmetu)'}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-stone-400">
                            <span>{e.from_name || e.from_email}</span>
                            <span>{formatDateTime(e.date)}</span>
                            {e.has_attachments && <span>📎 {e.attachment_count}</span>}
                          </div>
                        </div>
                        <span className="text-stone-300 text-xs mt-1">{isOpen ? '▼' : '▶'}</span>
                      </div>
                      {isOpen && (
                        <div className="border-t border-stone-100 p-4 bg-stone-50">
                          <div className="text-[11px] text-stone-400 mb-3 space-y-0.5">
                            <div><span className="font-medium">Od:</span> {e.from_name} &lt;{e.from_email}&gt;</div>
                            {e.to_addresses && <div className="break-words"><span className="font-medium">Komu:</span> {Array.isArray(e.to_addresses) ? e.to_addresses.join(', ') : e.to_addresses}</div>}
                          </div>
                          <div className="text-sm text-stone-700 whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed">{e.text_body || '(prázdny)'}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ATTACHMENTS */}
          {results.attachments.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">Emailové prílohy ({results.attachments.length})</h2>
              <div className="space-y-2">
                {results.attachments.map(function(a) {
                  return (
                    <div key={a.id} className="bg-white rounded-xl border border-stone-100 p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-lg">📎</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-800 break-words">{a.filename}</div>
                          {a.parentEmail && (
                            <div className="text-[11px] text-stone-400 mt-1">
                              z emailu: <span className="text-stone-600">{a.parentEmail.subject}</span> ({a.parentEmail.from_name}, {formatDate(a.parentEmail.date)})
                            </div>
                          )}
                          {a.text_length > 0 && <div className="text-[10px] text-stone-400 mt-0.5">{a.text_length.toLocaleString()} znakov extrahovaného textu</div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* DOCUMENTS */}
          {results.documents.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">Dokumenty ({results.documents.length})</h2>
              <div className="space-y-2">
                {results.documents.map(function(d) {
                  var isOpen = expandedDoc === d.id
                  return (
                    <div key={d.id} className="bg-white rounded-xl border border-stone-100 overflow-hidden">
                      <div onClick={function() { setExpandedDoc(isOpen ? null : d.id); if (!isOpen) loadDocText(d.id) }} className="p-4 cursor-pointer hover:bg-stone-50 flex items-start gap-3">
                        <span className="text-[10px] px-1.5 py-0.5 bg-stone-200 rounded text-stone-600 font-mono flex-shrink-0 mt-0.5">{d.extension}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-800 break-words">{d.filename}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-stone-400">
                            {d.date && <span>{formatDate(d.date)}</span>}
                            {d.folder && <span className="truncate max-w-[250px]">{d.folder}</span>}
                          </div>
                        </div>
                        <span className="text-stone-300 text-xs mt-1">{d.text_length > 0 ? (isOpen ? '▼' : '▶') : ''}</span>
                      </div>
                      {isOpen && (
                        <div className="border-t border-stone-100 p-4 bg-stone-50">
                          {docText[d.id] === undefined ? (
                            <div className="text-stone-300 text-sm animate-pulse">Načítavam...</div>
                          ) : (
                            <div className="text-sm text-stone-700 whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto leading-relaxed">
                              {docText[d.id] || '(bez textu)'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {total === 0 && (
            <div className="text-center py-12 text-stone-300">
              <div className="text-3xl mb-2">∅</div>
              <div className="text-sm">Žiadne výsledky</div>
            </div>
          )}
        </div>
      )}

      {!results && !loading && (
        <div className="text-center py-16 text-stone-300">
          <div className="text-5xl mb-4">⌕</div>
          <div className="text-sm text-stone-400">Zadajte hľadaný výraz a stlačte Enter</div>
          <div className="text-[11px] text-stone-300 mt-2">Hľadá v emailoch, emailových prílohách a dokumentoch</div>
        </div>
      )}
    </div>
  )
}
