import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Gem } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { ProductCard } from '@/components/product-card'
import { CatalogFilters } from '@/components/catalog-filters'
import { FloatingWhatsApp } from '@/components/whatsapp-button'

import {
  getCategories,
  getProducts,
  getShopSettings,
} from '@/lib/data'

export const metadata: Metadata = {
  title: 'Collection',
  description:
    'Browse the full collection of gold and silver jewellery at LEELA JEWELLERS, Jodhpur. Search and filter by category, availability and price.',
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string
    search?: string
    availability?: 'all' | 'available' | 'out'
    sort?: 'newest' | 'price_low' | 'price_high'
  }>
}) {
  const params = await searchParams

  const [settings, categories, products] =
    await Promise.all([
      getShopSettings(),
      getCategories(),
      getProducts({
        category: params.category,
        search: params.search,
        availability: params.availability,
        sort: params.sort,
      }),
    ])

  const activeCategory = categories.find(
    (category) =>
      category.slug === params.category,
  )

  const availabilityLabel =
    params.availability === 'available'
      ? 'Available Products'
      : params.availability === 'out'
        ? 'Out of Stock Products'
        : null

  const sortLabel =
    params.sort === 'price_low'
      ? 'Price: Low to High'
      : params.sort === 'price_high'
        ? 'Price: High to Low'
        : null

  return (
    <div className="flex min-h-svh flex-col">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <SiteHeader
        shopName={settings.shop_name}
        categories={categories}
      />

      <main className="flex-1">

        {/* ====================================================
            PAGE TITLE
        ==================================================== */}

        <section className="border-b border-border/70 bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-10 text-center md:px-6">

            <p className="text-xs uppercase tracking-[0.25em] text-gold">
              {activeCategory
                ? activeCategory.name
                : availabilityLabel ||
                  'Our Collection'}
            </p>

            <h1 className="mt-2 font-serif text-4xl font-semibold text-primary md:text-5xl">
              {activeCategory
                ? activeCategory.name
                : availabilityLabel ||
                  'Explore Jewellery'}
            </h1>

            {/* SEARCH RESULT */}
            {params.search && (
              <p className="mt-2 text-sm text-muted-foreground">
                Results for &ldquo;
                {params.search}
                &rdquo;
              </p>
            )}

            {/* SORT RESULT */}
            {sortLabel && (
              <p className="mt-1 text-xs text-muted-foreground">
                Sorted by {sortLabel}
              </p>
            )}

          </div>
        </section>

        {/* ====================================================
            FILTERS
        ==================================================== */}

        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">

          <Suspense
            fallback={
              <div className="h-24" />
            }
          >
            <CatalogFilters
              categories={categories}
            />
          </Suspense>

          {/* ==================================================
              PRODUCTS
          ================================================== */}

          <div className="mt-8">

            {products.length > 0 ? (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  {products.length}{' '}
                  {products.length === 1
                    ? 'piece'
                    : 'pieces'}
                </p>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">

                  {products.map(
                    (product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                      />
                    ),
                  )}

                </div>
              </>
            ) : (

              /* =================================================
                 NO PRODUCTS
              ================================================= */

              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">

                <Gem className="size-10 text-muted-foreground/40" />

                <p className="font-serif text-xl text-foreground">
                  No products found
                </p>

                <p className="max-w-sm text-sm text-muted-foreground">
                  Try a different category,
                  availability option, search
                  term or price sorting option.
                  You can also reach out to us
                  on WhatsApp for a specific
                  piece.
                </p>

              </div>
            )}

          </div>
        </div>
      </main>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <SiteFooter
        settings={settings}
        categories={categories}
      />

      {/* ======================================================
          FLOATING WHATSAPP
      ====================================================== */}

      <FloatingWhatsApp
        whatsappNumber={
          settings.whatsapp_number
        }
        shopName={settings.shop_name}
      />

    </div>
  )
}
