import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'ATHRX Founder Control Center',
  description: 'Founder dashboard for ATHRX production control'
}

export default function RootLayout({
  children
}: {
  children: ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}