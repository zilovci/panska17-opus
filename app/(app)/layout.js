'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../components/opus'

var NAV_ITEMS = [
  { href: '/',         label: 'Prehľad',  icon: '◉' },
  { href: '/kauzy',    label: 'Kauzy',    icon: '◈' },
  { href: '/tasky',    label: 'Úlohy',    icon: '◇' },
  { href: '/hladanie', label: 'Hľadanie', icon: '⌕' },
]

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault(); setLoading(true); setError(null)
    var { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false) }
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
              <input type="email" value={email} onChange={function(e){setEmail(e.target.value)}} className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" required />
            </div>
            <div className="mb-6">
              <label className="block text-[11px] font-medium text-stone-500 mb-1.5 uppercase tracking-wider">Heslo</label>
              <input type="password" value={password} onChange={function(e){setPassword(e.target.value)}} className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400" required />
            </div>
            {error && <div className="mb-4 text-red-600 text-sm text-center bg-red-50 rounded-lg py-2">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 disabled:opacity-40">
              {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

function NavLink({ href, label, icon, active }) {
  return (
    <Link href={href} className={'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ' + (active ? 'bg-stone-800 text-white font-medium' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100')}>
      <span className="text-xs">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}

function Shell({ user, children }) {
  var pathname = usePathname()

  return (
    <div className="min-h-screen bg-stone-50">
      {/* HEADER */}
      <header className="bg-white border-b border-stone-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-5">
            <Link href="/" className="flex items-center gap-2">
              <div>
                <div className="text-[8px] md:text-[9px] font-mono tracking-[0.3em] text-stone-300 leading-none">PANSKÁ 17</div>
                <div className="text-lg md:text-xl font-extralight tracking-wide text-stone-800 leading-tight">OPUS</div>
              </div>
            </Link>
            <div className="h-6 w-px bg-stone-100 hidden sm:block" />
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map(function(item) {
                var active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                return <NavLink key={item.href} {...item} active={active} />
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-stone-400">{user.email}</div>
              <button onClick={function(){supabase.auth.signOut()}} className="text-[10px] text-stone-300 hover:text-stone-500">Odhlásiť sa</button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-4 md:px-6 pb-8">
        <div className="text-center text-[10px] text-stone-300">
          OPUS v0.9 — Opus non fingitur, sed factis demonstratur.
        </div>
      </footer>
    </div>
  )
}

export default function AppLayout({ children }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(function() {
    supabase.auth.getUser().then(function(r) {
      setUser(r.data.user)
      setChecking(false)
    })
    var sub = supabase.auth.onAuthStateChange(function(ev, session) {
      setUser(session ? session.user : null)
    })
    return function() { sub.data.subscription.unsubscribe() }
  }, [])

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-3xl font-extralight tracking-wide text-stone-300 animate-pulse">OPUS</div>
      </main>
    )
  }

  if (!user) return <LoginForm />

  return <Shell user={user}>{children}</Shell>
}
