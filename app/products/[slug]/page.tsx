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

type StoneCharge = {
  id: string
  stone_name: string | null
  size: string | null
  quality: string | null
  pcs: number | null
  price_per_pc: number | null
  weight: number | null
}

type OtherCharge = {
  id: string
  charge_type: string | null
  description: string | null
  quantity: number | null
  price_per_unit: number | null
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

async function getProductCharges(productId: string) {
  const supabase = await createClient()

  const [stoneResult, otherResult] = await Promise.all([
    supabase
      .from('product_stone_charges')
      .select(
        'id, stone_name, size, quality, pcs, price_per_pc, weight'
      )
      .eq('product_id', productId),

    supabase
      .from('product_other_charges')
      .select(
        'id, charge_type, description, quantity, price_per_unit'
      )
      .eq('product_id', productId),
  ])

  return {
    stones: (stoneResult.data ?? []) as StoneCharge[],
    others: (otherResult.data ?? []) as OtherCharge[],
  }
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`
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

  const charges = await getProductCharges(String(product.id))

  const image = product.product_images?.[0]

  const productData = product as typeof product & {
    gross_weight?: number | string | null
    stone_weight?: number | string | null
    net_weight?: number | string | null

    wastage_value?: number | string | null
    wastage_type?: string | null
    wastage_basis?: string | null

    making_value?: number | string | null
    making_type?: string | null
    making_basis?: string | null

    gst_percent?: number | string | null
  }

  const grossWeight = Number(productData.gross_weight || 0)

  const stoneWeightFromProduct = Number(
    productData.stone_weight || 0
  )

  const stoneWeightFromRows = charges.stones.reduce(
    (sum, stone) => sum + Number(stone.weight || 0),
    0
  )

  const totalStoneWeight =
    stoneWeightFromProduct || stoneWeightFromRows

  const netMetalWeight =
    Number(productData.net_weight || 0) ||
    Math.max(grossWeight - totalStoneWeight, 0)

  const isGold =
    product.categories?.name?.toLowerCase().includes('gold')

  const isSilver =
    product.categories?.name?.toLowerCase().includes('silver')

  const purity = product.purity?.toLowerCase() || ''

  const currentRate = isSilver
    ? Number(rates?.silver || 0)
    : purity.includes('24')
      ? Number(rates?.gold_24k || 0)
      : purity.includes('22')
        ? Number(rates?.gold_22k || 0)
        : isGold
          ? Number(rates?.gold_22k || 0)
          : 0

  /*
   * METAL VALUE
   * Net metal weight × today's metal rate
   */
  const metalValue = netMetalWeight * currentRate

  /*
   * MAKING CHARGES
   *
   * Default:
   * per gram × net weight
   *
   * If type is percent:
   * percentage × selected basis
   */
  const makingValue = Number(productData.making_value || 0)
  const makingType = productData.making_type || 'per_gram'
  const makingBasis = productData.making_basis || 'net_weight'

  const makingBasisValue =
    makingBasis === 'metal_value'
      ? metalValue
      : grossWeight

  const makingCharges =
    makingType === 'percent'
      ? (makingValue / 100) * makingBasisValue
      : makingValue * (
          makingBasis === 'gross_weight'
            ? grossWeight
            : netMetalWeight
        )

  /*
   * WASTAGE / VA
   */
  const wastageValue = Number(productData.wastage_value || 0)
  const wastageType = productData.wastage_type || 'percent'
  const wastageBasis = productData.wastage_basis || 'metal_value'

  const wastageBasisValue =
    wastageBasis === 'net_weight'
      ? netMetalWeight
      : metalValue

  const wastageCharges =
    wastageType === 'percent'
      ? (wastageValue / 100) * wastageBasisValue
      : wastageValue * netMetalWeight

  /*
   * STONE CHARGES
   * Every row = PCS × price per PC
   */
  const stoneCharges = charges.stones.reduce(
    (sum, stone) =>
      sum +
      Number(stone.pcs || 0) *
        Number(stone.price_per_pc || 0),
    0
  )

  /*
   * OTHER CHARGES
   * Every row = quantity × price per unit
   */
  const otherCharges = charges.others.reduce(
    (sum, charge) =>
      sum +
      Number(charge.quantity || 0) *
        Number(charge.price_per_unit || 0),
    0
  )

  const subtotal =
    metalValue +
    makingCharges +
    wastageCharges +
    stoneCharges +
    otherCharges

  const gstPercent = Number(productData.gst_percent ?? 3)

  const gst = (subtotal * gstPercent) / 100

  const estimatedTotal = subtotal + gst

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader
        shopName={settings.shop_name}
        categories={categories}
      />

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

            {/* PRODUCT IMAGE */}
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

            {/* PRODUCT DETAILS */}
            <div className="flex flex-col">

              {product.categories && (
                <p className="text-xs uppercase tracking-[0.25em] text-gold">
                  {product.categories.name}
                </p>
              )}

              <h1 className="mt-3 font-serif text-4xl font-semibold text-primary md:text-5xl">
                {product.name}
              </h1>

              {/* WEIGHT DETAILS */}
              <div className="mt-6">
                <h2 className="font-serif text-xl font-semibold text-primary">
                  Weight Details
                </h2>

                <div className="mt-3 grid grid-cols-2 gap-3">

                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Gross Weight
                    </p>
                    <p className="mt-1 font-medium">
                      {grossWeight.toFixed(3)} GM
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Stone Weight
                    </p>
                    <p className="mt-1 font-medium">
                      {totalStoneWeight.toFixed(3)} GM
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Net Metal Weight
                    </p>
                    <p className="mt-1 font-medium">
                      {netMetalWeight.toFixed(3)} GM
                    </p>
                  </div>

                  {product.purity && (
                    <div className="rounded-xl border border-border/70 p-4">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        Purity
                      </p>
                      <p className="mt-1 font-medium">
                        {product.purity}
                      </p>
                    </div>
                  )}

                </div>
              </div>

              {/* PRICE CALCULATION */}
              <div className="mt-6 rounded-2xl border border-border/70 bg-secondary/30 p-5">

                <h2 className="font-serif text-2xl font-semibold text-primary">
                  Price Calculation
                </h2>

                {currentRate > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Today&apos;s{' '}
                    {isSilver
                      ? 'Silver'
                      : product.purity || 'Gold'}{' '}
                    rate:{' '}
                    <span className="font-medium text-foreground">
                      {money(currentRate)}/gram
                    </span>
                  </p>
                )}

                <div className="mt-5 space-y-3 text-sm">

                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Net Metal Weight
                    </span>
                    <span className="font-medium">
                      {netMetalWeight.toFixed(3)} GM
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Metal Value
                    </span>
                    <span className="font-medium">
                      {money(metalValue)}
                    </span>
                  </div>

                  {makingCharges > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Making Charges
                      </span>
                      <span className="font-medium">
                        {money(makingCharges)}
                      </span>
                    </div>
                  )}

                  {wastageCharges > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Wastage / VA
                      </span>
                      <span className="font-medium">
                        {money(wastageCharges)}
                      </span>
                    </div>
                  )}

                  {stoneCharges > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Stone Charges
                      </span>
                      <span className="font-medium">
                        {money(stoneCharges)}
                      </span>
                    </div>
                  )}

                  {otherCharges > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Other Charges
                      </span>
                      <span className="font-medium">
                        {money(otherCharges)}
                      </span>
                    </div>
                  )}

                  <div className="my-2 border-t border-border/70" />

                  <div className="flex justify-between gap-4">
                    <span className="font-medium">
                      Subtotal
                    </span>
                    <span className="font-medium">
                      {money(subtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      GST ({gstPercent}%)
                    </span>
                    <span className="font-medium">
                      {money(gst)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-primary p-4 text-primary-foreground">
                    <span className="font-medium">
                      Estimated Total
                    </span>

                    <span className="font-serif text-xl font-semibold">
                      {money(estimatedTotal)}
                    </span>
                  </div>

                </div>
              </div>

              {/* STONE DETAILS */}
              {charges.stones.length > 0 && (
                <div className="mt-6">
                  <h2 className="font-serif text-xl font-semibold text-primary">
                    Stone Details
                  </h2>

                  <div className="mt-3 space-y-2">

                    {charges.stones.map((stone) => {
                      const rowTotal =
                        Number(stone.pcs || 0) *
                        Number(stone.price_per_pc || 0)

                      return (
                        <div
                          key={stone.id}
                          className="rounded-xl border border-border/70 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">

                            <div>
                              {stone.stone_name && (
                                <p className="font-medium">
                                  {stone.stone_name}
                                </p>
                              )}

                              <div className="mt-1 text-xs text-muted-foreground">
                                {stone.size && (
                                  <span>Size: {stone.size} · </span>
                                )}

                                {stone.quality && (
                                  <span>
                                    Quality: {stone.quality} ·{' '}
                                  </span>
                                )}

                                <span>
                                  {Number(stone.pcs || 0)} PC
                                </span>
                              </div>
                            </div>

                            <p className="font-medium">
                              {money(rowTotal)}
                            </p>

                          </div>
                        </div>
                      )
                    })}

                  </div>
                </div>
              )}

              {/* OTHER CHARGES */}
              {charges.others.length > 0 && (
                <div className="mt-6">
                  <h2 className="font-serif text-xl font-semibold text-primary">
                    Other Charges
                  </h2>

                  <div className="mt-3 space-y-2">

                    {charges.others.map((charge) => {
                      const rowTotal =
                        Number(charge.quantity || 0) *
                        Number(charge.price_per_unit || 0)

                      return (
                        <div
                          key={charge.id}
                          className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4"
                        >
                          <div>
                            <p className="font-medium">
                              {charge.charge_type || 'Other'}
                            </p>

                            {charge.description && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {charge.description}
                              </p>
                            )}

                            <p className="mt-1 text-xs text-muted-foreground">
                              Qty: {Number(charge.quantity || 0)}
                            </p>
                          </div>

                          <p className="font-medium">
                            {money(rowTotal)}
                          </p>
                        </div>
                      )
                    })}

                  </div>
                </div>
              )}

              {/* DESCRIPTION */}
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

              {/* WHATSAPP */}
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

      <SiteFooter
        settings={settings}
        categories={categories}
      />

      <FloatingWhatsApp
        whatsappNumber={settings.whatsapp_number}
        shopName={settings.shop_name}
      />
    </div>
  )
}
