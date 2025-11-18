import { Playfair_Display } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-playfair'
})

export const metadata = {
  title: 'Easy Piano Arranger',
  description: 'AI-powered piano sheet music simplification using OpenAI and abcjs',
  icons: {
    icon: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={playfair.className}>{children}</body>
    </html>
  )
}
