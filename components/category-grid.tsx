import Link from 'next/link'
import { Gem } from 'lucide-react'
import type { Category } from '@/lib/types'

export function CategoryGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null

  return (
    <section id="categories" className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <div className="mb-8 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">
          Browse by
        </p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-primary md:text-4xl">
          Our Categories
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/products?category=${c.slug}`}
            className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-5 transition-colors hover:border-gold/50 hover:bg-gold/5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
              <Gem className="size-5" />
            </span>
            <span className="font-serif text-lg font-medium text-foreground group-hover:text-primary">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
