import './globals.css'

export const metadata = {
  title: 'OPUS — Panská 17',
  description: 'Právny informačný systém',
}

export default function RootLayout({ children }) {
  return (
    <html lang="sk">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-stone-50 text-stone-900 min-h-screen font-sans">
        {children}
      </body>
    </html>
  )
}
