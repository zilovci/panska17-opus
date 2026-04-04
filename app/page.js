'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-light tracking-wide mb-1">OPUS</h1>
          <p className="text-stone-400 text-sm">Panská 17, Bratislava</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8">
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm text-stone-600 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-amber-500" required />
            </div>
            <div className="mb-6">
              <label className="block text-sm text-stone-600 mb-1">Heslo</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-amber-500" required />
            </div>
            {error && <div className="mb-4 text-red-600 text-sm text-center">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-50">
              {loading ? 'Prihlasujem...' : 'Prihlásiť sa'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

function Dashboard({ user }) {
  const [stats, setStats] = useState({ emailCount: 0, docCount: 0, cases: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [emails, docs, cases] = await Promise.all([
        supabase.from('emails').select('id', { count: 'exact', head: true }),
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('cases').select('*').eq('status', 'active'),
      ])
      setStats({
        emailCount: emails.count || 0,
        docCount: docs.count || 0,
        cases: cases.data || [],
      })
      setLoading(false)
    }
    load()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center"><p className="text-stone-400">Načítavam...</p></main>

  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <div className="flex justify-between items-start mb-16">
        <div>
          <h1 className="text-5xl font-light tracking-wide mb-2">OPUS</h1>
          <p className="text-stone-500 text-lg">Panská 17, Bratislava</p>
          <p className="text-stone-400 text-sm mt-1">Právny informačný systém</p>
        </div>
        <div className="text-right">
          <p className="text-stone-500 text-sm mb-2">{user.email}</p>
          <button onClick={handleSignOut} className="text-xs text-stone-400 hover:text-stone-600">
            Odhlásiť sa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-16">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 text-center">
          <div className="text-3xl font-light text-amber-700">{stats.emailCount.toLocaleString()}</div>
          <div className="text-stone-500 text-sm mt-1">emailov</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 text-center">
          <div className="text-3xl font-light text-amber-700">{stats.docCount.toLocaleString()}</div>
          <div className="text-stone-500 text-sm mt-1">dokumentov</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 text-center">
          <div className="text-3xl font-light text-amber-700">{stats.cases.length}</div>
          <div className="text-stone-500 text-sm mt-1">aktívnych kauz</div>
        </div>
      </div>

      {stats.cases.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200">
          <div className="px-6 py-4 border-b border-stone-100">
            <h2 className="text-lg font-medium">Aktívne kauzy</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {stats.cases.map(c => (
              <div key={c.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <span className="inline-block bg-amber-100 text-amber-800 text-xs font-mono px-2 py-0.5 rounded mr-3">{c.code}</span>
                  <span className="text-stone-800">{c.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  c.priority === 'urgent' ? 'bg-red-200 text-red-800' :
                  c.priority === 'high' ? 'bg-red-100 text-red-700' :
                  c.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>{c.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center mt-16 text-stone-400 text-xs">OPUS v0.2 — {new Date().getFullYear()}</div>
    </main>
  )
}

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

  if (checking) return <main className="min-h-screen flex items-center justify-center"><p className="text-stone-400">...</p></main>
  if (!user) return <LoginForm />
  return <Dashboard user={user} />
}
