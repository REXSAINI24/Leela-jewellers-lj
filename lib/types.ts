export type Category = {
  id: string
  name: string
  slug: string
  sort_order: number
  created_at: string
}

export type ProductImage = {
  id: string
  product_id: string
  storage_path: string
  public_url: string
  sort_order: number
  created_at: string
}

export type Product = {
  id: string
  name: string
  slug: string
  sku: string | null
  category_id: string | null
  rate: string | null
  weight: string | null
  price: number | null
  purity: string | null
  description: string | null
  is_available: boolean
  is_featured: boolean
  created_at: string
  updated_at: string
}

export type ProductWithRelations = Product & {
  categories: Pick<Category, 'id' | 'name' | 'slug'> | null
  product_images: ProductImage[]
}

export type ShopSettings = {
  id: number
  shop_name: string
  address: string
  phone: string
  whatsapp_number: string
  google_maps_url: string | null
  about: string | null
  updated_at: string
}
