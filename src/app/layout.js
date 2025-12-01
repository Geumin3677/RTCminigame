import './globals.css'
import { Inter } from 'next/font/google'
import { Suspense } from "react";

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'df',
  description: 'asdf',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <Suspense fallback={<div>Loading...</div>}>
        <body className={inter.className}>{children}</body>
      </Suspense>
    </html>
  )
}
