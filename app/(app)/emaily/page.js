'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, formatDate, formatDateTime } from '../../components/opus'

var PAGE_SIZE = 40

// ─── Debounce hook ─────────────────────────────────────────
function useDebounce(value, delay) {
  var [debounced, setDebounced] = useState(value)
  useEffect(function() {
    var t = setTimeout(function() { setDebounced(value) }, delay)
    return function() { clearTimeout(t) }
  }, [value, delay])
  return debounced
}

// ─── People who appear most in emails ──────────────────────
var PEOPLE = [
  { label: 'Všetci', value: '' },
  { label: 'Novodvorský', value: 'novodvorsk' },
  { label: 'Németh', value: 'nemeth' },
  { label: 'Kaššovicová', value: 'kassovic' },
  { label: 'Paiček', value: 'paicek' },
  { label: 'Vlk', value: 'vlk' },
  { label: 'Bosáková', value: 'bosak' },
  { label: 'Vierka', value: 'zilova' },
  { label: 'Blahovec', value: 'blahov' },
  { label: 'Slimáková', value: 'slimak' },
  { label: 'Gubrica', value: 'gubric' },
  { label: 'British Council', value: 'british' },
  { label: 'Kaláber', value: 'kalaber' },
  { label: 'Meier', value: 'meier' },
]

var FOLDERS = [
  { label: 'Všetky', value: '' },
  { label: 'Inbox', value: 'Inbox' },
  { label: 'Odoslané', value: 'SentItems' },
  { label: 'Paiček', value: 'Paicek' },
  { label: 'Ventúrska', value: 'VenturskaNajomnici' },
  { label: 'BC', value: 'BC' },
  { label: 'P17 kúpa', value: 'P17kupa' },
  { label: 'Služby', value: 'Sluzby' },
]

// ─── Snippet from email body ───────────────────────────────
function snippet(text, len) {
  if (!text) return ''
  var clean = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  return clean.length > len ? clean.substring(0, len) + '…' : clean
}

// ─── Email list item ───────────────────────────────────────
function EmailItem({ email, selected, onClick }) {
  var isSelected = selected && selected.id === email.id
  var dirClass = email.direction === 'sent' ? 'border-l-blue-400' : 'border-l-transparent'

  return (
    <button
      onClick={function() { onClick(email) }}
      className={'w-full text-left px-4 py-3 border-l-[3px] transition-colors ' + dirClass + ' ' + (isSelected ? 'bg-stone-100' : 'hover:bg-stone-50')}
    >
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-[13px] font-medium text-stone-800 truncate">
          {email.direction === 'sent' ? '→ ' : ''}{email.from_name || email.from_email || '(neznámy)'}
        </span>
        <span className="text-[11px] text-stone-400 whitespace-nowrap flex-shrink-0">{formatDate(email.date)}</span>
      </div>
      <div className="text-[13px] text-stone-700 truncate leading-snug">{email.subject || '(bez predmetu)'}</div>
      <div className="text-[11px] text-stone-400 truncate mt-0.5 leading-snug">{snippet(email.text_body, 100)}</div>
      {email.attachment_count > 0 && (
        <div className="text-[10px] text-stone-400 mt-1">📎 {email.attachment_count}</div>
      )}
    </button>
  )
}

// ─── Email detail view ─────────────────────────────────────
function EmailDetail({ email, attachments }) {
  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-300">
        <div className="text-center">
          <div className="text-4xl mb-3">✉</div>
          <div className="text-sm">Vyber email zo zoznamu</div>
        </div>
      </div>
    )
  }

  // Format addresses
  function formatAddr(arr) {
    if (!arr || arr.length === 0) return null
    return arr.join(', ')
  }

  // Format body text — preserve paragraphs
  function formatBody(text) {
    if (!text) return '(prázdny email)'
    return text
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Email header */}
      <div className="px-6 py-5 border-b border-stone-100 bg-white sticky top-0 z-10">
        <h2 className="text-lg font-medium text-stone-900 leading-snug mb-3">{email.subject || '(bez predmetu)'}</h2>
        <div className="space-y-1.5 text-[13px]">
          <div className="flex gap-2">
            <span className="text-stone-400 w-10 flex-shrink-0">Od:</span>
            <span className="text-stone-700 font-medium">{email.from_name || ''} <span className="text-stone-400 font-normal">&lt;{email.from_email}&gt;</span></span>
          </div>
          <div className="flex gap-2">
            <span className="text-stone-400 w-10 flex-shrink-0">Komu:</span>
            <span className="text-stone-600 break-all">{formatAddr(email.to_addresses) || '—'}</span>
          </div>
          {email.cc_addresses && email.cc_addresses.length > 0 && (
            <div className="flex gap-2">
              <span className="text-stone-400 w-10 flex-shrink-0">CC:</span>
              <span className="text-stone-500 break-all text-[12px]">{formatAddr(email.cc_addresses)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="text-stone-400 w-10 flex-shrink-0">Dátum:</span>
            <span className="text-stone-600">{formatDateTime(email.date)}</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-stone-400 w-10 flex-shrink-0">Zdroj:</span>
            <span className={'text-[11px] px-2 py-0.5 rounded-full ' + (email.direction === 'sent' ? 'bg-blue-50 text-blue-600' : 'bg-stone-100 text-stone-500')}>{email.source_file}</span>
            {email.forwarded_from_email && (
              <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                ↪ pôv. od: {email.forwarded_from_name || email.forwarded_from_email}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Email body */}
      <div className="px-6 py-5">
        <pre className="text-[13px] text-stone-700 leading-relaxed whitespace-pre-wrap font-[Georgia,serif] max-w-none">{formatBody(email.text_body)}</pre>
      </div>

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50/50">
          <div className="text-[11px] font-medium text-stone-400 uppercase tracking-wider mb-2">Prílohy ({attachments.length})</div>
          <div className="space-y-2">
            {attachments.map(function(att) {
              var sizeStr = !att.size_bytes ? '' : att.size_bytes < 102400 ? Math.round(att.size_bytes / 1024) + ' KB' : (att.size_bytes / 1048576).toFixed(1) + ' MB'
              var hasText = att.text_length > 0
              var isForwardedMsg = att.content_type === 'message/rfc822'
              var isOldDoc = att.filename && att.filename.match(/\.doc$/i) && !att.filename.match(/\.docx$/i)
              
              // Label for status
              var statusLabel = null
              if (isForwardedMsg) statusLabel = { text: 'preposlený email', color: 'text-amber-500 bg-amber-50' }
              else if (hasText) statusLabel = null // will use Čítať button
              else if (isOldDoc) statusLabel = { text: '.doc — bez textu', color: 'text-orange-400 bg-orange-50' }
              else if (!hasText && sizeStr) statusLabel = { text: 'len na disku', color: 'text-stone-300 bg-transparent' }

              if (hasText && !isForwardedMsg) {
                return (
                  <details key={att.id} className="bg-white rounded-lg border border-stone-100 group">
                    <summary className="flex items-center gap-2 text-[12px] text-stone-600 px-3 py-2.5 cursor-pointer hover:bg-stone-50 rounded-lg list-none">
                      <span className="text-stone-400">📎</span>
                      <span className="font-medium truncate flex-1">{att.filename}</span>
                      {sizeStr && <span className="text-stone-400 flex-shrink-0">{sizeStr}</span>}
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px] flex-shrink-0">▸ Čítať</span>
                    </summary>
                    <div className="px-4 py-3 border-t border-stone-50">
                      <pre className="text-[13px] text-stone-600 leading-relaxed whitespace-pre-wrap font-[Georgia,serif] max-h-[500px] overflow-y-auto">{att.extracted_text}</pre>
                    </div>
                  </details>
                )
              }
              return (
                <div key={att.id} className="flex items-center gap-2 text-[12px] text-stone-600 bg-white rounded-lg px-3 py-2.5 border border-stone-100">
                  <span className="text-stone-400">{isForwardedMsg ? '↪' : '📎'}</span>
                  <span className="font-medium truncate flex-1">{isForwardedMsg ? (att.filename === 'att_0' ? 'Preposlený email (vložený)' : att.filename) : att.filename}</span>
                  {sizeStr && <span className="text-stone-400 flex-shrink-0">{sizeStr}</span>}
                  {statusLabel && <span className={'text-[11px] px-2 py-0.5 rounded flex-shrink-0 ' + statusLabel.color}>{statusLabel.text}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────
export default function EmilyPage() {
  var [emails, setEmails] = useState([])
  var [total, setTotal] = useState(0)
  var [loading, setLoading] = useState(true)
  var [page, setPage] = useState(0)
  var [selected, setSelected] = useState(null)
  var [attachments, setAttachments] = useState([])

  // Filters
  var [search, setSearch] = useState('')
  var [person, setPerson] = useState('')
  var [folder, setFolder] = useState('')
  var [dateFrom, setDateFrom] = useState('')
  var [dateTo, setDateTo] = useState('')

  var debouncedSearch = useDebounce(search, 400)
  var listRef = useRef(null)

  // ─── Fetch emails ──────────────────────────────────────
  var fetchEmails = useCallback(async function() {
    setLoading(true)
    try {
      var query = supabase
        .from('emails')
        .select('id, date, from_name, from_email, to_addresses, cc_addresses, subject, text_body, direction, source_file, attachment_count, has_attachments, forwarded_from_name, forwarded_from_email', { count: 'exact' })
        .order('date', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      // Person filter — search in from, to, forwarded
      if (person) {
        query = query.or('from_name.ilike.%' + person + '%,from_email.ilike.%' + person + '%,forwarded_from_name.ilike.%' + person + '%,forwarded_from_email.ilike.%' + person + '%,subject.ilike.%' + person + '%')
      }

      // Folder filter
      if (folder) {
        query = query.eq('source_file', folder)
      }

      // Date filters
      if (dateFrom) {
        query = query.gte('date', dateFrom + 'T00:00:00')
      }
      if (dateTo) {
        query = query.lte('date', dateTo + 'T23:59:59')
      }

      // Text search
      if (debouncedSearch) {
        // Use ilike for simple search
        query = query.or('subject.ilike.%' + debouncedSearch + '%,text_body.ilike.%' + debouncedSearch + '%,from_name.ilike.%' + debouncedSearch + '%')
      }

      var { data, error, count } = await query
      if (error) throw error
      setEmails(data || [])
      setTotal(count || 0)
    } catch (err) {
      console.error('Chyba pri načítaní emailov:', err)
    }
    setLoading(false)
  }, [page, person, folder, dateFrom, dateTo, debouncedSearch])

  useEffect(function() {
    fetchEmails()
  }, [fetchEmails])

  // Reset page when filters change
  useEffect(function() {
    setPage(0)
  }, [person, folder, dateFrom, dateTo, debouncedSearch])

  // ─── Select email and load attachments ─────────────────
  async function selectEmail(email) {
    setSelected(email)
    setAttachments([])
    if (email.has_attachments) {
      var { data } = await supabase
        .from('email_attachments')
        .select('id, filename, content_type, size_bytes, extracted_text, text_length')
        .eq('email_id', email.id)
        .order('filename')
      setAttachments(data || [])
    }
  }

  var totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex gap-0 -mx-4 md:-mx-6 -my-6 md:-my-8" style={{ height: 'calc(100vh - 73px)' }}>
      {/* LEFT: Email list — full width on mobile, fixed width on desktop */}
      <div className={'flex-shrink-0 border-r border-stone-200 bg-white flex flex-col ' + (selected ? 'hidden md:flex md:w-[380px] lg:w-[420px]' : 'w-full md:w-[380px] lg:w-[420px]')}>
        {/* Search + filters */}
        <div className="p-3 border-b border-stone-100 space-y-2">
          <input
            type="text"
            placeholder="Hľadať v emailoch..."
            value={search}
            onChange={function(e) { setSearch(e.target.value) }}
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-stone-50"
          />
          <div className="flex gap-1.5">
            <select
              value={person}
              onChange={function(e) { setPerson(e.target.value) }}
              className="flex-1 text-[12px] px-2 py-1.5 border border-stone-200 rounded-lg bg-white text-stone-600 focus:outline-none"
            >
              {PEOPLE.map(function(p) {
                return <option key={p.value} value={p.value}>{p.label}</option>
              })}
            </select>
            <select
              value={folder}
              onChange={function(e) { setFolder(e.target.value) }}
              className="flex-1 text-[12px] px-2 py-1.5 border border-stone-200 rounded-lg bg-white text-stone-600 focus:outline-none"
            >
              {FOLDERS.map(function(f) {
                return <option key={f.value} value={f.value}>{f.label}</option>
              })}
            </select>
          </div>
          <div className="flex gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={function(e) { setDateFrom(e.target.value) }}
              className="flex-1 text-[11px] px-2 py-1.5 border border-stone-200 rounded-lg bg-white text-stone-500 focus:outline-none"
              placeholder="Od"
            />
            <input
              type="date"
              value={dateTo}
              onChange={function(e) { setDateTo(e.target.value) }}
              className="flex-1 text-[11px] px-2 py-1.5 border border-stone-200 rounded-lg bg-white text-stone-500 focus:outline-none"
              placeholder="Do"
            />
            {(dateFrom || dateTo || person || folder || search) && (
              <button
                onClick={function() { setSearch(''); setPerson(''); setFolder(''); setDateFrom(''); setDateTo('') }}
                className="text-[11px] px-2 py-1.5 text-stone-400 hover:text-stone-600"
                title="Vyčistiť filtre"
              >✕</button>
            )}
          </div>
        </div>

        {/* Count */}
        <div className="px-4 py-2 text-[11px] text-stone-400 border-b border-stone-50 flex justify-between">
          <span>{total.toLocaleString('sk-SK')} emailov</span>
          {totalPages > 1 && <span>str. {page + 1} z {totalPages}</span>}
        </div>

        {/* Email list */}
        <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-stone-50">
          {loading && emails.length === 0 ? (
            <div className="p-8 text-center text-stone-300 text-sm animate-pulse">Načítavam…</div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center text-stone-300 text-sm">Žiadne emaily</div>
          ) : (
            emails.map(function(email) {
              return <EmailItem key={email.id} email={email} selected={selected} onClick={selectEmail} />
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-3 py-2 border-t border-stone-100 flex items-center justify-between bg-stone-50/50">
            <button
              onClick={function() { setPage(Math.max(0, page - 1)); if (listRef.current) listRef.current.scrollTop = 0 }}
              disabled={page === 0}
              className="text-[12px] px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 disabled:opacity-30 hover:bg-stone-50"
            >← Novšie</button>
            <button
              onClick={function() { setPage(Math.min(totalPages - 1, page + 1)); if (listRef.current) listRef.current.scrollTop = 0 }}
              disabled={page >= totalPages - 1}
              className="text-[12px] px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-600 disabled:opacity-30 hover:bg-stone-50"
            >Staršie →</button>
          </div>
        )}
      </div>

      {/* RIGHT: Email content — hidden on mobile until email selected */}
      <div className={'flex-1 bg-white flex flex-col overflow-hidden ' + (selected ? 'flex' : 'hidden md:flex')}>
        {/* Mobile back button */}
        {selected && (
          <button
            onClick={function() { setSelected(null); setAttachments([]) }}
            className="md:hidden flex items-center gap-1.5 px-4 py-2.5 text-[13px] text-stone-500 border-b border-stone-100 bg-stone-50 hover:bg-stone-100"
          >
            ← Späť na zoznam
          </button>
        )}
        <EmailDetail email={selected} attachments={attachments} />
      </div>
    </div>
  )
}
