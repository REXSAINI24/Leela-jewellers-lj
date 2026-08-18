'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

export function CatalogFilters({
  categories,
}: {
  categories: Category[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeCategory =
    searchParams.get('category') ?? ''

  const [search, setSearch] = useState(
    searchParams.get('search') ?? '',
  )

  /*
   * ============================================================
   * FIND GOLD / SILVER CATEGORIES
   * ============================================================
   *
   * Hum existing categories ko hi use kar rahe hain.
   * Database mein koi nayi category/table nahi banani.
   */

  const goldCategory = categories.find((category) =>
    category.name.toLowerCase().includes('gold'),
  )

  const silverCategory = categories.find((category) =>
    category.name.toLowerCase().includes('silver'),
  )

  /*
   * ============================================================
   * DEBOUNCED SEARCH
   * ============================================================
   */

  useEffect(() => {
    const current =
      searchParams.get('search') ?? ''

    if (search === current) return

    const timeout = setTimeout(() => {
      const params = new URLSearchParams(
        searchParams.toString(),
      )

      if (search.trim()) {
        params.set('search', search.trim())
      } else {
        params.delete('search')
      }

      router.replace(
        `/products?${params.toString()}`,
      )
    }, 350)

    return () => clearTimeout(timeout)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  /*
   * ============================================================
   * CATEGORY SELECT
   * ============================================================
   */

  function selectCategory(slug: string) {
    const params = new URLSearchParams(
      searchParams.toString(),
    )

    if (slug) {
      params.set('category', slug)
    } else {
      params.delete('category')
    }

    router.replace(
      `/products?${params.toString()}`,
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ======================================================
          SEARCH BOX
      ====================================================== */}

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />

        <Input
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search jewellery by name, description or ID..."
          className="pl-9 pr-9"
          aria-label="Search products"
        />

        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ======================================================
          QUICK METAL FILTERS
      ====================================================== */}

      {(goldCategory || silverCategory) && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Quick Filter
          </p>

          <div className="flex gap-2 overflow-x-auto pb-1">

            {goldCategory && (
              <FilterChip
                label="Gold"
                active={
                  activeCategory ===
                  goldCategory.slug
                }
                onClick={() =>
                  selectCategory(
                    goldCategory.slug,
                  )
                }
              />
            )}

            {silverCategory && (
              <FilterChip
                label="Silver"
                active={
                  activeCategory ===
                  silverCategory.slug
                }
                onClick={() =>
                  selectCategory(
                    silverCategory.slug,
                  )
                }
              />
            )}

            <FilterChip
              label="All"
              active={activeCategory === ''}
              onClick={() =>
                selectCategory('')
              }
            />

          </div>
        </div>
      )}

      {/* ======================================================
          ALL CATEGORIES
      ====================================================== */}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Categories
        </p>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">

          <FilterChip
            label="All Categories"
            active={activeCategory === ''}
            onClick={() =>
              selectCategory('')
            }
          />

          {categories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              active={
                activeCategory ===
                category.slug
              }
              onClick={() =>
                selectCategory(
                  category.slug,
                )
              }
            />
          ))}

        </div>
      </div>
    </div>
  )
}

/*
 * ============================================================
 * FILTER CHIP
 * ============================================================
 */

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-foreground/80 hover:border-gold/50 hover:text-primary',
      )}
    >
      {label}
    </button>
  )
}
