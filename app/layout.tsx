import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Nav } from './components/Nav'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GR LinkedIn Assistant',
  description: 'AI suggestions for the LinkedIn page you are viewing, and reviewed email outreach',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <Nav />
        {children}
      </body>
    </html>
  )
}
