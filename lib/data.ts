import { createClient } from '@/lib/supabase/server'
import type {
  Category,
  MetalRates,
  ProductWithRelations,
  ShopSettings,
} from '@/lib/types'

const PRODUCT_SELECT =
  '*, categories ( id, name, slug ), product_images ( id, product_id, storage_path, public_url, sort_order, created_at )'

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
 * CURRENT METAL RATES
 * ============================================================
 *
 * Admin Panel me save ki hui current Gold/Silver rates
 * website par bhi available rahengi.
 */
export async function getMetalRates(): Promise<MetalRates> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('metal_rates')
    .select('gold_24k, gold_22k, silver, updated_at')
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

  return sortImages(
    (data as ProductWithRelations[]) ?? [],
  )
}

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

  if (params.category) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', params.category)
      .maybeSingle()

    if (cat) {
      query = query.eq('category_id', cat.id)
    }
  }

  if (params.search) {
    query = query.or(
      `name.ilike.%${params.search}%,description.ilike.%${params.search}%,sku.ilike.%${params.search}%`,
    )
  }

  const { data } = await query

  return sortImages(
    (data as ProductWithRelations[]) ?? [],
  )
}

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

  return sortImages([
    data as ProductWithRelations,
  ])[0]
}

export async function getAllProductSlugs(): Promise<string[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('products')
    .select('slug')

  return (data ?? []).map((p) => p.slug)
}
