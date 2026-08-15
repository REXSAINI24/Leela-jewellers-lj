import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { HeroSection } from '@/components/hero-section'
import { CategoryGrid } from '@/components/category-grid'
import { ContactSection } from '@/components/contact-section'
import { ProductCard } from '@/components/product-card'
import { FloatingWhatsApp } from '@/components/whatsapp-button'
import { Button } from '@/components/ui/button'
import {
  getCategories,
  getFeaturedProducts,
  getProducts,
  getShopSettings,
} from '@/lib/data'

export default async function HomePage() {
  const [settings, categories, featured] = await Promise.all([
    getShopSettings(),
    getCategories(),
    getFeaturedProducts(8),
  ])

  // Fall back to latest products if nothing is flagged as featured yet.
  const highlight =
    featured.length > 0 ? featured : (await getProducts()).slice(0, 8)

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader shopName={settings.shop_name} categories={categories} />
      <main className="flex-1">
        <HeroSection settings={settings} />

        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gold">
                Handpicked
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-primary md:text-4xl">
                Featured Pieces
              </h2>
            </div>
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/products">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          {highlight.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {highlight.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
              <p>Our collection is being curated. Please check back soon.</p>
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Button asChild variant="outline">
              <Link href="/products">
                View full collection
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <CategoryGrid categories={categories} />
        <ContactSection settings={settings} />
      </main>
      <SiteFooter settings={settings} categories={categories} />
      <FloatingWhatsApp
        whatsappNumber={settings.whatsapp_number}
        shopName={settings.shop_name}
      />
    </div>
  )
}
