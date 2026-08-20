import { createClient } from '@/lib/supabase/server'
import type {
  Category,
  MetalRates,
  ProductWithRelations,
  ShopSettings,
} from '@/lib/types'

const PRODUCT_SELECT =
  '*, categories ( id, name, slug ), product_images ( id, product_id, storage_path, public_url, sort_order, created_at )'

type PricingStone = {
  pcs?: string | number
  price_per_pc?: string | number
  weight?: string | number
}

type PricingOther = {
  quantity?: string | number
  price_per_unit?: string | number
}

type SavedPricing = {
  pricing_mode?: 'metal_rate' | 'piece'
  gross_weight?: string | number
  stone_weight?: string | number
  net_weight?: string | number

  wastage_value?: string | number
  wastage_type?: string
  wastage_basis?: string

  making_value?: string | number
  making_type?: string
  making_basis?: string

  gst_percent?: string | number

  stones?: PricingStone[]
  other_charges?: PricingOther[]
}

function num(value: string | number | null | undefined) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function sortImages(
  products: ProductWithRelations[],
): ProductWithRelations[] {
  return products.map((p) => ({
    ...p,
    product_images: [...(p.product_images ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }))
}

/*
 * ============================================================
 * PRODUCT ESTIMATED PRICE
 * ============================================================
 *
 * Metal Value
 * + Wastage / VA
 * + Making Charges
 * + Stone Charges
 * + Other Charges
 * + GST
 *
 * = Estimated Price
 */
function calculateProductPrice(
  product: ProductWithRelations,
  rates: MetalRates,
): number | null {
  const data = product as ProductWithRelations & {
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
    pricing_details?: SavedPricing | null
  }

  const savedPricing = data.pricing_details

  const grossWeight = savedPricing
    ? num(savedPricing.gross_weight)
    : num(data.gross_weight || product.weight)

  const stoneRows = Array.isArray(savedPricing?.stones)
    ? savedPricing.stones
    : []

  const otherRows = Array.isArray(savedPricing?.other_charges)
    ? savedPricing.other_charges
    : []

  const stoneWeightFromRows = stoneRows.reduce(
    (sum, stone) => sum + num(stone.weight),
    0,
  )

  const manualStoneWeight = savedPricing
    ? num(savedPricing.stone_weight)
    : num(data.stone_weight)

  const stoneWeight =
    stoneRows.length > 0
      ? stoneWeightFromRows
      : manualStoneWeight

  const savedNetWeight = savedPricing
    ? num(savedPricing.net_weight)
    : num(data.net_weight)

  const netWeight =
    savedNetWeight > 0
      ? savedNetWeight
      : Math.max(grossWeight - stoneWeight, 0)

  /*
   * ============================================================
   * DIRECT / PIECE PRICE
   * ============================================================
   *
   * Explicit pricing_mode is preferred. For older products that
   * were created before pricing_mode existed, a product with no
   * metal weight and a saved rate/price is treated as a piece-price
   * product.
   */
  const directPiecePrice =
    num(product.price) > 0
      ? num(product.price)
      : num(product.rate)

  const isPiecePriceProduct =
    savedPricing?.pricing_mode === 'piece' ||
    (!savedPricing?.pricing_mode &&
      netWeight <= 0 &&
      directPiecePrice > 0)

  if (isPiecePriceProduct) {
    return directPiecePrice > 0
      ? directPiecePrice
      : null
  }

  /*
   * Weight-based products require metal weight and today's metal
   * rate. If either is unavailable, the customer will see
   * Enquire for Price.
   */
  if (netWeight <= 0) {
    return null
  }

  /*
   * ============================================================
   * METAL RATE
   * ============================================================
   */

  const categoryName =
    product.categories?.name?.toLowerCase() ?? ''

  const purity =
    product.purity?.toLowerCase() ?? ''

  const isSilver =
    categoryName.includes('silver') ||
    purity.includes('silver')

  const isGold =
    categoryName.includes('gold')

  let currentRate = 0

  if (isSilver) {
    currentRate = num(rates.silver)
  } else if (purity.includes('24')) {
    currentRate = num(rates.gold_24k)
  } else if (purity.includes('22')) {
    currentRate = num(rates.gold_22k)
  } else if (isGold) {
    currentRate = num(rates.gold_22k)
  } else {
    currentRate = 0
  }

  /*
   * Weight-based product needs today's metal rate.
   */
  if (currentRate <= 0) {
    return null
  }

  /*
   * ============================================================
   * METAL VALUE
   * ============================================================
   */

  const metalValue =
    netWeight * currentRate

  /*
   * ============================================================
   * MAKING CHARGES
   * ============================================================
   */

  const makingValue = savedPricing
    ? num(savedPricing.making_value)
    : num(data.making_value)

  const makingType =
    savedPricing?.making_type ??
    data.making_type ??
    'per_gram'

  const makingBasis =
    savedPricing?.making_basis ??
    data.making_basis ??
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
          : netWeight

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
    : num(data.wastage_value)

  const wastageType =
    savedPricing?.wastage_type ??
    data.wastage_type ??
    'percent'

  const wastageBasis =
    savedPricing?.wastage_basis ??
    data.wastage_basis ??
    'metal_value'

  let wastageCharges = 0

  if (wastageValue > 0) {
    if (wastageType === 'fixed') {
      wastageCharges = wastageValue
    } else {
      let basis = metalValue

      if (wastageBasis === 'net_weight') {
        basis = netWeight
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

  const stoneCharges = stoneRows.reduce(
    (sum, stone) =>
      sum +
      num(stone.pcs) *
        num(stone.price_per_pc),
    0,
  )

  /*
   * ============================================================
   * OTHER CHARGES
   * ============================================================
   */

  const otherCharges = otherRows.reduce(
    (sum, charge) =>
      sum +
      num(charge.quantity) *
        num(charge.price_per_unit),
    0,
  )

  /*
   * ============================================================
   * SUBTOTAL
   * ============================================================
   */

  const subtotal =
    metalValue +
    wastageCharges +
    makingCharges +
    stoneCharges +
    otherCharges

  /*
   * ============================================================
   * GST
   * ============================================================
   */

  const gstValue = savedPricing
    ? num(savedPricing.gst_percent)
    : num(data.gst_percent ?? 3)

  const gstPercent =
    gstValue > 0 ? gstValue : 3

  const gst =
    subtotal * gstPercent / 100

  /*
   * ============================================================
   * FINAL ESTIMATED PRICE
   * ============================================================
   */

  return subtotal + gst
}

/*
 * ============================================================
 * ADD ESTIMATED PRICES
 * ============================================================
 *
 * IMPORTANT:
 *
 * Weight-based product:
 *   calculated price available -> use calculated price
 *
 * Piece/direct-price product:
 *   calculation returns null -> keep original product.price
 *
 * This makes piece products independent from daily metal rate.
 */
async function addEstimatedPrices(
  products: ProductWithRelations[],
): Promise<ProductWithRelations[]> {
  if (products.length === 0) {
    return products
  }

  const rates = await getMetalRates()

  return products.map((product) => {
    const estimatedPrice =
      calculateProductPrice(product, rates)

    return {
      ...product,

      /*
       * If metal-rate calculation is available,
       * use it.
       *
       * Otherwise keep the original direct/piece price.
       */
      price:
        estimatedPrice !== null
          ? estimatedPrice
          : product.price ??
            (product.rate && !product.weight
              ? Number(product.rate)
              : product.price),
    }
  })
}

export async function getShopSettings(): Promise<ShopSettings> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('shop_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  return (
    data ?? {
      id: 1,
      shop_name: 'LEELA JEWELLERS',
      address:
        'Main Road, Mata Ka Than, Magra Punjala, Jodhpur, Rajasthan, India',
      phone: '+919000000000',
      whatsapp_number: '+919000000000',
      google_maps_url: '',
      about: '',
      updated_at: new Date().toISOString(),
    }
  )
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })

  return data ?? []
}

/*
 * ============================================================
 * METAL RATES
 * ============================================================
 */

export async function getMetalRates(): Promise<MetalRates> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('metal_rates')
    .select(
      'gold_24k, gold_22k, silver, updated_at',
    )
    .eq('id', 1)
    .maybeSingle()

  return (
    data ?? {
      gold_24k: null,
      gold_22k: null,
      silver: null,
      updated_at: null,
    }
  )
}

/*
 * ============================================================
 * FEATURED PRODUCTS
 * ============================================================
 */

export async function getFeaturedProducts(
  limit = 6,
): Promise<ProductWithRelations[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  const products =
    sortImages(
      (data as ProductWithRelations[]) ?? [],
    )

  return addEstimatedPrices(products)
}

/*
 * ============================================================
 * ALL PRODUCTS
 * ============================================================
 */

export async function getProducts(
  params: {
    category?: string
    search?: string
  } = {},
): Promise<ProductWithRelations[]> {
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false })

  /*
   * CATEGORY FILTER
   */

  if (params.category) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', params.category)
      .maybeSingle()

    if (cat) {
      query = query.eq(
        'category_id',
        cat.id,
      )
    }
  }

  /*
   * SEARCH
   */

  if (params.search) {
    query = query.or(
      `name.ilike.%${params.search}%,description.ilike.%${params.search}%,sku.ilike.%${params.search}%`,
    )
  }

  const { data } = await query

  const products =
    sortImages(
      (data as ProductWithRelations[]) ?? [],
    )

  return addEstimatedPrices(products)
}

/*
 * ============================================================
 * SINGLE PRODUCT
 * ============================================================
 */

export async function getProductBySlug(
  slug: string,
): Promise<ProductWithRelations | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .maybeSingle()

  if (!data) {
    return null
  }

  const products =
    sortImages([
      data as ProductWithRelations,
    ])

  const enriched =
    await addEstimatedPrices(products)

  return enriched[0] ?? null
}

/*
 * ============================================================
 * PRODUCT SLUGS
 * ============================================================
 */

export async function getAllProductSlugs(): Promise<string[]> {
  const supabase = await createClient()

  const { data } =
    await supabase
      .from('products')
      .select('slug')

  return (data ?? []).map(
    (p) => p.slug,
  )
}
