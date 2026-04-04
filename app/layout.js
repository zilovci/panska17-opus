import './globals.css'

export const metadata = {
  title: 'OPUS — Panská 17',
  description: 'Právny informačný systém',
}

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <body className="bg-stone-50 text-stone-900 min-h-screen">
        {children}
      </body>
    </html>
  )
}
