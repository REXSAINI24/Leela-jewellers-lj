import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Jost } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { VisitorTracker } from '@/components/visitor-tracker'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
})

const siteUrl = 'https://leelajewellers.example'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'LEELA JEWELLERS — Gold & Silver Jewellery in Jodhpur',
    template: '%s | LEELA JEWELLERS',
  },
  description:
    'LEELA JEWELLERS in Jodhpur, Rajasthan. Explore our exquisite collection of gold and silver jewellery, rings, earrings, necklaces, chains and bangles. Enquire on WhatsApp.',
  keywords: [
    'jewellery Jodhpur',
    'gold jewellery',
    'silver jewellery',
    'Leela Jewellers',
    'rings',
    'necklaces',
    'bangles',
    'Rajasthan jewellery',
  ],
  generator: 'v0.app',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: 'LEELA JEWELLERS',
    title: 'LEELA JEWELLERS — Gold & Silver Jewellery in Jodhpur',
    description:
      'Explore our exquisite collection of gold and silver jewellery. Enquire on WhatsApp.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LEELA JEWELLERS — Gold & Silver Jewellery in Jodhpur',
    description:
      'Explore our exquisite collection of gold and silver jewellery. Enquire on WhatsApp.',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#c9a227',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${jost.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <VisitorTracker />

        {children}

        <Toaster position="top-center" richColors />

        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
