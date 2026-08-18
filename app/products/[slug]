import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Gem } from 'lucide-react'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { FloatingWhatsApp, WhatsAppButton } from '@/components/whatsapp-button'
import {
  getCategories,
  getProductBySlug,
  getShopSettings,
} from '@/lib/data'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ slug: string }>
}

async function getMetalRates() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('metal_rates')
    .select('gold_24k, gold_22k, silver, updated_at')
    .eq('id', 1)
    .maybeSingle()

  return data
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    return { title: 'Product Not Found' }
  }

  return {
    title: product.name,
    description:
      product.description ||
      `${product.name} at LEELA JEWELLERS, Jodhpur. Enquire on WhatsApp for today's price and availability.`,
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params

  const [settings, categories, product, rates] = await Promise.all([
    getShopSettings(),
    getCategories(),
    getProductBySlug(slug),
    getMetalRates(),
  ])

  if (!product) notFound()

  const image = product.product_images?.[0]
  const isGold = product.categories?.name?.toLowerCase().includes('gold')
  const isSilver = product.categories?.name?.toLowerCase().includes('silver')

  const currentRate =
    isSilver
      ? rates?.silver
      : product.purity?.toLowerCase().includes('22')
        ? rates?.gold_22k
        : product.purity?.toLowerCase().includes('24')
          ? rates?.gold_24k
          : isGold
            ? rates?.gold_22k
            : null

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader shopName={settings.shop_name} categories={categories} />

      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Collection
          </Link>

          <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-border/70 bg-secondary">
              {image?.public_url ? (
                <Image
                  src={image.public_url}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground/50">
                  <Gem className="size-16" />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center">
              {product.categories && (
                <p className="text-xs uppercase tracking-[0.25em] text-gold">
                  {product.categories.name}
                </p>
              )}

              <h1 className="mt-3 font-serif text-4xl font-semibold text-primary md:text-5xl">
                {product.name}
              </h1>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {product.weight && (
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Weight
                    </p>
                    <p className="mt-1 font-medium">{product.weight} GM</p>
                  </div>
                )}

                {product.purity && (
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Purity
                    </p>
                    <p className="mt-1 font-medium">{product.purity}</p>
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-border/70 bg-secondary/30 p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Price
                </p>
                <p className="mt-1 font-serif text-2xl font-semibold text-primary">
                  Price on Request
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Final price depends on today's metal rate and applicable making
                  charges.
                </p>

                {currentRate != null && (
                  <p className="mt-3 text-sm font-medium">
                    Today&apos;s {isSilver ? 'Silver' : product.purity || 'Gold'} rate:{' '}
                    ₹{Number(currentRate).toLocaleString('en-IN')}/gram
                  </p>
                )}
              </div>

              {product.description && (
                <div className="mt-6">
                  <h2 className="font-serif text-xl font-semibold text-primary">
                    Description
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {product.description}
                  </p>
                </div>
              )}

              <div className="mt-7">
                <WhatsAppButton
                  whatsappNumber={settings.whatsapp_number}
                  shopName={settings.shop_name}
                  product={product}
                  size="lg"
                  className="w-full sm:w-auto"
                  label="Enquire on WhatsApp"
                />
              </div>

              {!product.is_available && (
                <p className="mt-3 text-sm text-muted-foreground">
                  This product is currently unavailable. Please contact us for
                  similar designs.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter settings={settings} categories={categories} />
      <FloatingWhatsApp
        whatsappNumber={settings.whatsapp_number}
        shopName={settings.shop_name}
      />
    </div>
  )
}
