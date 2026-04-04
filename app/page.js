import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function getStats() {
  try {
    const [emails, docs, cases] = await Promise.all([
      supabase.from('emails').select('id', { count: 'exact', head: true }),
      supabase.from('documents').select('id', { count: 'exact', head: true }),
      supabase.from('cases').select('*').eq('status', 'active'),
    ])
    return {
      emailCount: emails.count || 0,
      docCount: docs.count || 0,
      cases: cases.data || [],
    }
  } catch {
    return { emailCount: 0, docCount: 0, cases: [] }
  }
}

export const revalidate = 60

export default async function Home() {
  const { emailCount, docCount, cases } = await getStats()

  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-light tracking-wide mb-2">OPUS</h1>
        <p className="text-stone-500 text-lg">Panská 17, Bratislava</p>
        <p className="text-stone-400 text-sm mt-1">Právny informačný systém</p>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-16">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 text-center">
          <div className="text-3xl font-light text-amber-700">{emailCount.toLocaleString()}</div>
          <div className="text-stone-500 text-sm mt-1">emailov</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 text-center">
          <div className="text-3xl font-light text-amber-700">{docCount.toLocaleString()}</div>
          <div className="text-stone-500 text-sm mt-1">dokumentov</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200 text-center">
          <div className="text-3xl font-light text-amber-700">{cases.length}</div>
          <div className="text-stone-500 text-sm mt-1">aktívnych kauz</div>
        </div>
      </div>

      {cases.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200">
          <div className="px-6 py-4 border-b border-stone-100">
            <h2 className="text-lg font-medium">Aktívne kauzy</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {cases.map(c => (
              <div key={c.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <span className="inline-block bg-amber-100 text-amber-800 text-xs font-mono px-2 py-0.5 rounded mr-3">{c.code}</span>
                  <span className="text-stone-800">{c.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  c.priority === 'high' ? 'bg-red-100 text-red-700' :
                  c.priority === 'urgent' ? 'bg-red-200 text-red-800' :
                  c.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }`}>{c.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center mt-16 text-stone-400 text-xs">
        OPUS v0.2 — {new Date().getFullYear()}
      </div>
    </main>
  )
}
