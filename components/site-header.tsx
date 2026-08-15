'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Category } from '@/lib/types'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Collection' },
  { href: '/#categories', label: 'Categories' },
  { href: '/#contact', label: 'Contact' },
]

export function SiteHeader({
  shopName,
  categories,
}: {
  shopName: string
  categories: Category[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-serif text-xl font-semibold tracking-wide text-primary md:text-2xl">
            {shopName}
          </span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Jodhpur, Rajasthan
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Search products">
            <Link href="/products">
              <Search className="size-5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'overflow-hidden border-t border-border/70 md:hidden',
          open ? 'max-h-96' : 'max-h-0 border-t-0',
        )}
        style={{ transition: 'max-height 0.3s ease' }}
      >
        <nav className="flex flex-col gap-1 px-4 py-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-border/70 pt-2">
            <p className="px-3 pb-1 text-xs uppercase tracking-widest text-muted-foreground">
              Categories
            </p>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-secondary hover:text-primary"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}
