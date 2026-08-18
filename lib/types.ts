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

export type StoneRow = {
  id: string
  stone_name: string
  size: string
  quality: string
  pcs: string | number
  price_per_pc: string | number
  weight: string | number
}

export type OtherRow = {
  id: string
  charge_type: string
  description: string
  quantity: string | number
  price_per_unit: string | number
}

export type PricingDetails = {
  gross_weight?: string | number
  stone_weight?: string | number
  net_weight?: string | number

  wastage_value?: string | number
  wastage_type?: 'percent' | 'fixed' | string
  wastage_basis?:
    | 'metal_value'
    | 'net_weight'
    | 'gross_weight'
    | string

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

  /*
   * Product pricing saved from Admin Panel
   */
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

  pricing_details?: PricingDetails | null
}

export type ProductWithRelations = Product & {
  categories: Pick<Category, 'id' | 'name' | 'slug'> | null
  product_images: ProductImage[]
}

export type MetalRates = {
  gold_24k: number | null
  gold_22k: number | null
  silver: number | null
  updated_at?: string | null
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
