import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Gem } from 'lucide-react'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import {
  FloatingWhatsApp,
  WhatsAppButton,
} from '@/components/whatsapp-button'
import {
  getCategories,
  getProductBySlug,
  getShopSettings,
} from '@/lib/data'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ slug: string }>
}

type StoneRow = {
  id: string
  stone_name: string
  size: string
  quality: string
  pcs: string | number
  price_per_pc: string | number
  weight: string | number
}

type OtherRow = {
  id: string
  charge_type: string
  description: string
  quantity: string | number
  price_per_unit: string | number
}

type PricingDetails = {
  gross_weight?: string | number
  stone_weight?: string | number
  net_weight?: string | number

  wastage_value?: string | number
  wastage_type?: 'percent' | 'fixed' | string
  wastage_basis?: 'metal_value' | 'net_weight' | 'gross_weight' | string

  making_value?: string | number
  making_type?: 'per_gram' | 'percent' | 'fixed' | string
  making_basis?: 'net_weight' | 'gross_weight' | string

  gst_percent?: string | number

  stones?: StoneRow[]
  other_charges?: OtherRow[]

  calculated?: {
    applicable_rate?: number
    metal_value?: number
    wastage?: number
    making?: number
    stone_total?: number
    other_total?: number
    subtotal?: number
    gst?: number
    estimated_total?: number
  }
}

type LegacyStoneCharge = {
  id: string
  stone_name: string | null
  size: string | null
  quality: string | null
  pcs: number | null
  price_per_pc: number | null
  weight: number | null
}

type LegacyOtherCharge = {
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

/*
 * OLD PRODUCTS SUPPORT
 *
 * Agar kisi purane product me pricing_details nahi hai,
 * to purani Supabase tables se charges read honge.
 */
async function getLegacyProductCharges(productId: string) {
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
    stones: (stoneResult.data ?? []) as LegacyStoneCharge[],
    others: (otherResult.data ?? []) as LegacyOtherCharge[],
  }
}

function num(value: string | number | null | undefined) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
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

  const productImage = product.product_images?.[0]?.public_url || undefined

  return {
    title: product.name,
    description:
      product.description ||
      `${product.name} at LEELA JEWELLERS, Jodhpur. Enquire on WhatsApp for today's price and availability.`,
    openGraph: {
      title: `${product.name} | LEELA JEWELLERS`,
      description:
        product.description ||
        `${product.name} at LEELA JEWELLERS. Enquire on WhatsApp for today's price and availability.`,
      type: 'website',
      images: productImage
        ? [
            {
              url: productImage,
              alt: product.name,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${product.name} | LEELA JEWELLERS`,
      description:
        product.description ||
        `${product.name} at LEELA JEWELLERS.`,
      images: productImage ? [productImage] : [],
    },
  }
}

export default async function ProductDetailPage({
  params,
}: PageProps) {
  const { slug } = await params

  const [settings, categories, product, rates] = await Promise.all([
    getShopSettings(),
    getCategories(),
    getProductBySlug(slug),
    getMetalRates(),
  ])

  if (!product) notFound()

  /*
   * ============================================================
   * PRODUCT DATA
   * ============================================================
   */

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

    // Optional inventory field. If your products table has this column,
    // it will control the stock badge automatically. If not, the page
    // safely falls back to the existing is_available flag.
    stock_quantity?: number | string | null

    pricing_details?: PricingDetails | null
  }

  const savedPricing = productData.pricing_details

  /*
   * ============================================================
   * INVENTORY / AVAILABILITY
   *
   * If stock_quantity exists in the products table, it becomes the
   * source of truth for stock status. Otherwise we keep backward
   * compatibility with the existing is_available flag.
   * ============================================================
   */

  const rawStockQuantity = productData.stock_quantity

  const hasStockTracking =
    rawStockQuantity !== null &&
    rawStockQuantity !== undefined &&
    String(rawStockQuantity).trim() !== ''

  const stockQuantity = hasStockTracking
    ? Math.max(0, Math.floor(num(rawStockQuantity)))
    : null

  const isOutOfStock = hasStockTracking
    ? stockQuantity === 0
    : !product.is_available

  const isLowStock =
    stockQuantity !== null &&
    stockQuantity > 0 &&
    stockQuantity <= 3

  /*
   * ============================================================
   * OLD PRODUCT CHARGES
   * ============================================================
   */

  const legacyCharges =
    savedPricing
      ? { stones: [], others: [] }
      : await getLegacyProductCharges(String(product.id))

  /*
   * ============================================================
   * PRODUCT IMAGE GALLERY
   *
   * Supabase se product ki saari uploaded images yahan milengi.
   * sort_order ke according images arrange hongi.
   * ============================================================
   */

  const productImages = [...(product.product_images ?? [])]
    .filter((item) => item?.public_url)
    .sort(
      (a, b) =>
        num(a.sort_order) - num(b.sort_order)
    )

  /*
   * ============================================================
   * WEIGHT
   * ============================================================
   */

  const grossWeight = savedPricing
    ? num(savedPricing.gross_weight)
    : num(productData.gross_weight || product.weight)

  const savedStoneRows = Array.isArray(savedPricing?.stones)
    ? savedPricing.stones
    : []

  const savedOtherRows = Array.isArray(
    savedPricing?.other_charges
  )
    ? savedPricing.other_charges
    : []

  const stoneWeightFromRows = savedStoneRows.reduce(
    (sum, stone) => sum + num(stone.weight),
    0
  )

  const manualStoneWeight = savedPricing
    ? num(savedPricing.stone_weight)
    : num(productData.stone_weight)

  const totalStoneWeight =
    savedStoneRows.length > 0
      ? stoneWeightFromRows
      : manualStoneWeight

  const savedNetWeight = savedPricing
    ? num(savedPricing.net_weight)
    : num(productData.net_weight)

  const netMetalWeight =
    savedNetWeight > 0
      ? savedNetWeight
      : Math.max(
          grossWeight - totalStoneWeight,
          0
        )

  /*
   * ============================================================
   * CATEGORY / PURITY / METAL RATE
   * ============================================================
   */

  const categoryName =
    product.categories?.name?.toLowerCase() ?? ''

  const isGold =
    categoryName.includes('gold')

  const isSilver =
    categoryName.includes('silver')

  const purity =
    product.purity?.toLowerCase() ?? ''

  const currentRate =
    isSilver
      ? num(rates?.silver)
      : purity.includes('24')
        ? num(rates?.gold_24k)
        : purity.includes('22')
          ? num(rates?.gold_22k)
          : isGold
            ? num(rates?.gold_22k)
            : num(product.rate)

  /*
   * ============================================================
   * METAL VALUE
   * ============================================================
   */

  const metalValue =
    netMetalWeight * currentRate

  /*
   * ============================================================
   * MAKING CHARGES
   * ============================================================
   */

  const makingValue = savedPricing
    ? num(savedPricing.making_value)
    : num(productData.making_value)

  const makingType =
    savedPricing?.making_type ??
    productData.making_type ??
    'per_gram'

  const makingBasis =
    savedPricing?.making_basis ??
    productData.making_basis ??
    'net_weight'

  let makingCharges = 0

  if (makingValue > 0) {
    if (makingType === 'fixed') {
      makingCharges = makingValue
    } else if (makingType === 'percent') {
      makingCharges =
        metalValue * makingValue / 100
    } else {
      const basisWeight =
        makingBasis === 'gross_weight'
          ? grossWeight
          : netMetalWeight

      makingCharges =
        basisWeight * makingValue
    }
  }

  /*
   * ============================================================
   * WASTAGE / VA
   * ============================================================
   */

  const wastageValue = savedPricing
    ? num(savedPricing.wastage_value)
    : num(productData.wastage_value)

  const wastageType =
    savedPricing?.wastage_type ??
    productData.wastage_type ??
    'percent'

  const wastageBasis =
    savedPricing?.wastage_basis ??
    productData.wastage_basis ??
    'metal_value'

  let wastageCharges = 0

  if (wastageValue > 0) {
    if (wastageType === 'fixed') {
      wastageCharges = wastageValue
    } else {
      let basis = metalValue

      if (wastageBasis === 'net_weight') {
        basis = netMetalWeight
      }

      if (wastageBasis === 'gross_weight') {
        basis = grossWeight
      }

      wastageCharges =
        basis * wastageValue / 100
    }
  }

  /*
   * ============================================================
   * STONE CHARGES
   * ============================================================
   */

  const stoneRows =
    savedStoneRows.length > 0
      ? savedStoneRows
      : legacyCharges.stones.map(
          (stone) => ({
            id: stone.id,
            stone_name: stone.stone_name ?? '',
            size: stone.size ?? '',
            quality: stone.quality ?? '',
            pcs: stone.pcs ?? 0,
            price_per_pc:
              stone.price_per_pc ?? 0,
            weight: stone.weight ?? 0,
          })
        )

  const stoneCharges =
    stoneRows.reduce(
      (sum, stone) =>
        sum +
        num(stone.pcs) *
          num(stone.price_per_pc),
      0
    )

  /*
   * ============================================================
   * OTHER CHARGES
   * ============================================================
   */

  const otherRows =
    savedOtherRows.length > 0
      ? savedOtherRows
      : legacyCharges.others.map(
          (charge) => ({
            id: charge.id,
            charge_type:
              charge.charge_type ?? 'Other',
            description:
              charge.description ?? '',
            quantity:
              charge.quantity ?? 0,
            price_per_unit:
              charge.price_per_unit ?? 0,
          })
        )

  const otherCharges =
    otherRows.reduce(
      (sum, charge) =>
        sum +
        num(charge.quantity) *
          num(charge.price_per_unit),
      0
    )

  /*
   * ============================================================
   * FINAL CALCULATION
   * ============================================================
   */

  const subtotal =
    metalValue +
    wastageCharges +
    makingCharges +
    stoneCharges +
    otherCharges

  const gstPercent = savedPricing
    ? num(savedPricing.gst_percent)
    : num(productData.gst_percent ?? 3)

  const finalGstPercent =
    gstPercent > 0
      ? gstPercent
      : 3

  const gst =
    subtotal *
    finalGstPercent /
    100

  const estimatedTotal =
    subtotal + gst

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

            {/* ==================================================
                PRODUCT IMAGE GALLERY
            ================================================== */}

            <div>

              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border/70 bg-secondary">

                {productImages.length > 0 ? (

                  <>
                    {productImages.map(
                      (item, index) => {
                        const radioId =
                          `product-image-${String(
                            product.id
                          )}-${index}`

                        return (
                          <div
                            key={
                              item.id ??
                              `${product.id}-${index}`
                            }
                            className="absolute inset-0"
                          >

                            <input
                              id={radioId}
                              type="radio"
                              name={`product-gallery-${String(
                                product.id
                              )}`}
                              defaultChecked={
                                index === 0
                              }
                              className="peer sr-only"
                            />

                            <div className="hidden h-full w-full peer-checked:block">
                              <Image
                                src={
                                  item.public_url
                                }
                                alt={`${product.name} - Image ${
                                  index + 1
                                }`}
                                fill
                                priority={
                                  index === 0
                                }
                                sizes="(max-width: 768px) 100vw, 50vw"
                                className="object-contain"
                              />
                            </div>

                          </div>
                        )
                      }
                    )}
                  </>

                ) : (

                  <div className="flex h-full items-center justify-center text-muted-foreground/50">
                    <Gem className="size-16" />
                  </div>

                )}

              </div>

              {/* ==================================================
                  THUMBNAILS
              ================================================== */}

              {productImages.length > 1 && (

                <div className="mt-4">

                  <div className="flex gap-3 overflow-x-auto pb-2">

                    {productImages.map(
                      (item, index) => {
                        const radioId =
                          `product-image-${String(
                            product.id
                          )}-${index}`

                        return (
                          <label
                            key={
                              item.id ??
                              `thumbnail-${product.id}-${index}`
                            }
                            htmlFor={radioId}
                            className="relative block size-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-secondary transition-all hover:border-primary md:size-24"
                          >

                            <Image
                              src={
                                item.public_url
                              }
                              alt={`${product.name} thumbnail ${
                                index + 1
                              }`}
                              fill
                              sizes="96px"
                              className="object-contain p-1"
                            />

                          </label>
                        )
                      }
                    )}

                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {productImages.length}{' '}
                    photos available · Tap a photo to view
                  </p>

                </div>

              )}

            </div>

            {/* ==================================================
                PRODUCT DETAILS
            ================================================== */}

            <div className="flex flex-col">

              {product.categories && (
                <p className="text-xs uppercase tracking-[0.25em] text-gold">
                  {product.categories.name}
                </p>
              )}

              <h1 className="mt-3 font-serif text-4xl font-semibold text-primary md:text-5xl">
                {product.name}
              </h1>

              {/* ==================================================
                  AVAILABILITY / STOCK STATUS
              ================================================== */}
              <div className="mt-4">
                {isOutOfStock ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
                    <span className="size-2 rounded-full bg-red-500" />
                    Out of Stock
                  </div>
                ) : isLowStock ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
                    <span className="size-2 rounded-full bg-amber-500" />
                    Only {stockQuantity} {stockQuantity === 1 ? 'piece' : 'pieces'} left
                  </div>
                ) : stockQuantity !== null ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    In Stock · {stockQuantity} pieces available
                  </div>
                ) : product.is_available ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Available
                  </div>
                ) : null}
              </div>

              {/* ==================================================
                  WEIGHT DETAILS
              ================================================== */}

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

              {/* ==================================================
                  PRICE CALCULATION
              ================================================== */}

              <div className="mt-6 rounded-2xl border border-border/70 bg-secondary/30 p-5">

                <h2 className="font-serif text-2xl font-semibold text-primary">
                  Price Calculation
                </h2>

                {currentRate > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Today&apos;s{' '}
                    {isSilver
                      ? 'Silver'
                      : product.purity ||
                        'Gold'}{' '}
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
                      {netMetalWeight.toFixed(
                        3
                      )}{' '}
                      GM
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Applicable Metal Rate
                    </span>

                    <span className="font-medium">
                      {money(currentRate)} /
                      GM
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

                  {wastageCharges > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Wastage / VA
                      </span>

                      <span className="font-medium">
                        {money(
                          wastageCharges
                        )}
                      </span>
                    </div>
                  )}

                  {makingCharges > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Making Charges
                      </span>

                      <span className="font-medium">
                        {money(
                          makingCharges
                        )}
                      </span>
                    </div>
                  )}

                  {stoneCharges > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Stone Charges
                      </span>

                      <span className="font-medium">
                        {money(
                          stoneCharges
                        )}
                      </span>
                    </div>
                  )}

                  {otherCharges > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        Other Charges
                      </span>

                      <span className="font-medium">
                        {money(
                          otherCharges
                        )}
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
                      GST ({finalGstPercent}%)
                    </span>

                    <span className="font-medium">
                      {money(gst)}
                    </span>
                  </div>

                  <div className="my-2 border-t border-border/70" />

                  <div className="flex items-center justify-between gap-4 rounded-xl bg-primary p-4 text-primary-foreground">

                    <span className="font-medium">
                      Estimated Total
                    </span>

                    <span className="font-serif text-xl font-semibold">
                      {money(
                        estimatedTotal
                      )}
                    </span>

                  </div>

                </div>
              </div>

              {/* ==================================================
                  STONE DETAILS
              ================================================== */}

              {stoneRows.length > 0 && (
                <div className="mt-6">

                  <h2 className="font-serif text-xl font-semibold text-primary">
                    Stone Details
                  </h2>

                  <div className="mt-3 space-y-2">

                    {stoneRows.map(
                      (stone) => {
                        const rowTotal =
                          num(stone.pcs) *
                          num(
                            stone.price_per_pc
                          )

                        return (
                          <div
                            key={stone.id}
                            className="rounded-xl border border-border/70 p-4"
                          >

                            <div className="flex items-start justify-between gap-4">

                              <div>

                                {stone.stone_name && (
                                  <p className="font-medium">
                                    {
                                      stone.stone_name
                                    }
                                  </p>
                                )}

                                <div className="mt-1 text-xs text-muted-foreground">

                                  {stone.size && (
                                    <span>
                                      Size:{' '}
                                      {
                                        stone.size
                                      }{' '}
                                      ·{' '}
                                    </span>
                                  )}

                                  {stone.quality && (
                                    <span>
                                      Quality:{' '}
                                      {
                                        stone.quality
                                      }{' '}
                                      ·{' '}
                                    </span>
                                  )}

                                  <span>
                                    {num(
                                      stone.pcs
                                    )}{' '}
                                    PC
                                  </span>

                                </div>

                              </div>

                              <p className="font-medium">
                                {money(
                                  rowTotal
                                )}
                              </p>

                            </div>

                          </div>
                        )
                      }
                    )}

                  </div>

                </div>
              )}

              {/* ==================================================
                  OTHER CHARGES
              ================================================== */}

              {otherRows.length > 0 && (
                <div className="mt-6">

                  <h2 className="font-serif text-xl font-semibold text-primary">
                    Other Charges
                  </h2>

                  <div className="mt-3 space-y-2">

                    {otherRows.map(
                      (charge) => {
                        const rowTotal =
                          num(
                            charge.quantity
                          ) *
                          num(
                            charge.price_per_unit
                          )

                        return (
                          <div
                            key={charge.id}
                            className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4"
                          >

                            <div>

                              <p className="font-medium">
                                {charge.charge_type ||
                                  'Other'}
                              </p>

                              {charge.description && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {
                                    charge.description
                                  }
                                </p>
                              )}

                              <p className="mt-1 text-xs text-muted-foreground">
                                Qty:{' '}
                                {num(
                                  charge.quantity
                                )}
                              </p>

                            </div>

                            <p className="font-medium">
                              {money(
                                rowTotal
                              )}
                            </p>

                          </div>
                        )
                      }
                    )}

                  </div>

                </div>
              )}

              {/* ==================================================
                  DESCRIPTION
              ================================================== */}

              {product.description && (
                <div className="mt-6">

                  <h2 className="font-serif text-xl font-semibold text-primary">
                    Description
                  </h2>

                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                    {
                      product.description
                    }
                  </p>

                </div>
              )}

              {/* ==================================================
                  WHATSAPP
              ================================================== */}

              <div className="mt-7">

                <WhatsAppButton
                  whatsappNumber={
                    settings.whatsapp_number
                  }
                  shopName={
                    settings.shop_name
                  }
                  product={product}
                  size="lg"
                  className="w-full sm:w-auto"
                  label="Enquire on WhatsApp"
                />

              </div>

              {isOutOfStock && (
                <p className="mt-3 text-sm text-muted-foreground">
                  This product is currently out of stock.
                  Please contact us for similar designs or availability.
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
        whatsappNumber={
          settings.whatsapp_number
        }
        shopName={
          settings.shop_name
        }
      />

    </div>
  )
}
