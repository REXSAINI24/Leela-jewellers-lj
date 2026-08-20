'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Category, Product, ShopSettings } from '@/lib/types'
import { slugify } from '@/lib/format'
import { cn } from '@/lib/utils'

type StoneRow = {
  id: string
  stone_name: string
  size: string
  quality: string
  pcs: string
  price_per_pc: string
  weight: string
}

type OtherRow = {
  id: string
  charge_type: string
  description: string
  quantity: string
  price_per_unit: string
}

type ExistingProductImage = {
  id: string
  storage_path: string
  public_url: string
  sort_order: number
}

type PricingDetails = {
  pricing_mode: 'metal_rate' | 'piece'
  gross_weight: string
  stone_weight: string
  net_weight: string
  wastage_value: string
  wastage_type: 'percent' | 'fixed'
  wastage_basis: 'metal_value' | 'net_weight' | 'gross_weight'
  making_value: string
  making_type: 'per_gram' | 'percent' | 'fixed'
  making_basis: 'net_weight' | 'gross_weight'
  gst_percent: string
  stones: StoneRow[]
  other_charges: OtherRow[]
}

type Popup = {
  type: 'success' | 'error' | 'warning'
  title: string
  message: string
}

type StockHistoryRow = {
  id: string | number
  product_id: string
  change_type: 'add' | 'remove' | 'sold' | 'set'
  previous_stock: number
  new_stock: number
  quantity_change: number
  note: string | null
  created_at: string
}

const emptyProduct = {
  id: '',
  name: '',
  slug: '',
  sku: '',
  category_id: '',
  rate: '',
  weight: '',
  price: '',
  purity: '',
  description: '',
  is_available: true,
  is_featured: false,
  stock_quantity: '1',
}

const emptyPricing: PricingDetails = {
  pricing_mode: 'metal_rate',
  gross_weight: '',
  stone_weight: '0',
  net_weight: '',
  wastage_value: '',
  wastage_type: 'percent',
  wastage_basis: 'metal_value',
  making_value: '',
  making_type: 'per_gram',
  making_basis: 'net_weight',
  gst_percent: '3',
  stones: [],
  other_charges: [],
}

const BUCKET = 'product-images'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function num(value: string | number | null | undefined) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function money(value: number) {
  return `₹${Math.max(0, value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [ready, setReady] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [showShopDetails, setShowShopDetails] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productThumbnails, setProductThumbnails] = useState<Record<string, string>>({})
  const [product, setProduct] = useState<typeof emptyProduct>(emptyProduct)
  const [pricing, setPricing] = useState<PricingDetails>(emptyPricing)
  const [chargeTypes, setChargeTypes] = useState<string[]>([])
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [autoSlug, setAutoSlug] = useState(true)
  const [rates, setRates] = useState({
    gold_24k: '',
    gold_22k: '',
    silver: '',
  })
  const [ratesBusy, setRatesBusy] = useState(false)

  // MULTIPLE IMAGE SYSTEM
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [existingProductImages, setExistingProductImages] = useState<ExistingProductImage[]>([])

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [newChargeType, setNewChargeType] = useState('')
  const [popup, setPopup] = useState<Popup | null>(null)

  // STOCK HISTORY
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)
  const [historyRows, setHistoryRows] = useState<StockHistoryRow[]>([])
  const [historyBusy, setHistoryBusy] = useState(false)

  // PRODUCT LIST CONTROLS
  const [productSearch, setProductSearch] = useState('')
  const [productCategoryFilter, setProductCategoryFilter] = useState('')
  const [productStatusFilter, setProductStatusFilter] = useState('all')
  const [productSort, setProductSort] = useState('newest')

  function showPopup(
    type: Popup['type'],
    title: string,
    details: string
  ) {
    setPopup({ type, title, message: details })
  }

  function errorText(error: any, fallback = 'Unknown error') {
    if (!error) return fallback

    return [
      error.message,
      error.details ? `Details: ${error.details}` : '',
      error.hint ? `Hint: ${error.hint}` : '',
      error.code ? `Code: ${error.code}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  async function load() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/admin/login')
        return
      }

      const { data: admin, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (adminError) {
        showPopup(
          'error',
          'Admin Check Failed',
          errorText(adminError)
        )
        return
      }

      if (!admin) {
        await supabase.auth.signOut()
        router.replace('/admin/login')
        return
      }

      const [s, c, p, r, ct] = await Promise.all([
        supabase
          .from('shop_settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle(),

        supabase
          .from('categories')
          .select('*')
          .order('sort_order', { ascending: true }),

        supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false }),

        supabase
          .from('metal_rates')
          .select('gold_24k, gold_22k, silver')
          .eq('id', 1)
          .maybeSingle(),

        supabase
          .from('other_charge_types')
          .select('name')
          .order('name'),
      ])

      if (s.error)
        showPopup(
          'error',
          'Shop Details Load Failed',
          errorText(s.error)
        )

      if (c.error)
        showPopup(
          'error',
          'Categories Load Failed',
          errorText(c.error)
        )

      if (p.error)
        showPopup(
          'error',
          'Products Load Failed',
          errorText(p.error)
        )

      if (r.error)
        showPopup(
          'error',
          'Metal Rates Load Failed',
          errorText(r.error)
        )

      if (ct.error)
        showPopup(
          'error',
          'Charge Types Load Failed',
          errorText(ct.error)
        )

      setSettings(s.data as ShopSettings | null)
      setCategories((c.data as Category[]) ?? [])
      setProducts((p.data as Product[]) ?? [])

      const loadedProducts = (p.data as Product[]) ?? []
      if (loadedProducts.length > 0) {
        const { data: imageRows, error: imageRowsError } = await supabase
          .from('product_images')
          .select('product_id, public_url, sort_order')
          .in('product_id', loadedProducts.map(item => item.id))
          .order('sort_order', { ascending: true })

        if (imageRowsError) {
          showPopup('error', 'Product Photos Load Failed', errorText(imageRowsError))
        } else {
          const thumbnails: Record<string, string> = {}
          for (const row of imageRows ?? []) {
            if (row.public_url && !thumbnails[String(row.product_id)]) {
              thumbnails[String(row.product_id)] = row.public_url
            }
          }
          setProductThumbnails(thumbnails)
        }
      } else {
        setProductThumbnails({})
      }

      if (r.data) {
        setRates({
          gold_24k:
            r.data.gold_24k == null
              ? ''
              : String(r.data.gold_24k),

          gold_22k:
            r.data.gold_22k == null
              ? ''
              : String(r.data.gold_22k),

          silver:
            r.data.silver == null
              ? ''
              : String(r.data.silver),
        })
      }

      setChargeTypes(
        (ct.data ?? []).map(
          (x: { name: string }) => x.name
        )
      )

      setAuthorized(true)
      setReady(true)
    } catch (error) {
      showPopup(
        'error',
        'Dashboard Error',
        errorText(error)
      )
    }
  }

  useEffect(() => {
    load()
  }, [])

  const canSaveProduct = useMemo(
    () => product.name.trim().length > 0,
    [product.name]
  )

  // Filter + sort the products shown in the admin product list.
  // This is only a frontend list control; it does not change the database.
  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase()

    const filtered = products.filter((p) => {
      const matchesSearch = !search ||
        [p.name, p.sku, p.purity, p.slug]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(search)
          )

      const matchesCategory =
        !productCategoryFilter ||
        p.category_id === productCategoryFilter

      const matchesStatus =
        productStatusFilter === 'all' ||
        (productStatusFilter === 'available' && p.is_available && num(p.stock_quantity) > 0) ||
        (productStatusFilter === 'out_of_stock' && (!p.is_available || num(p.stock_quantity) <= 0)) ||
        (productStatusFilter === 'featured' && p.is_featured)

      return matchesSearch && matchesCategory && matchesStatus
    })

    return [...filtered].sort((a, b) => {
      switch (productSort) {
        case 'name_asc':
          return String(a.name ?? '').localeCompare(String(b.name ?? ''))
        case 'name_desc':
          return String(b.name ?? '').localeCompare(String(a.name ?? ''))
        case 'price_asc':
          return num(a.price) - num(b.price)
        case 'price_desc':
          return num(b.price) - num(a.price)
        case 'weight_asc':
          return num(a.weight) - num(b.weight)
        case 'weight_desc':
          return num(b.weight) - num(a.weight)
        case 'newest':
        default:
          // load() already requests products newest-first.
          return 0
      }
    })
  }, [
    products,
    productSearch,
    productCategoryFilter,
    productStatusFilter,
    productSort,
  ])

  const productFiltersActive =
    Boolean(productSearch) ||
    Boolean(productCategoryFilter) ||
    productStatusFilter !== 'all' ||
    productSort !== 'newest'

  const stoneWeightFromRows = useMemo(
    () =>
      pricing.stones.reduce(
        (sum, row) => sum + num(row.weight),
        0
      ),
    [pricing.stones]
  )

  const grossWeight = num(pricing.gross_weight)
  const manuallyEnteredStoneWeight = num(
    pricing.stone_weight
  )

  const calculatedStoneWeight =
    pricing.stones.length > 0
      ? stoneWeightFromRows
      : manuallyEnteredStoneWeight

  const netWeight = Math.max(
    0,
    grossWeight - calculatedStoneWeight
  )

  const applicableRate = useMemo(() => {
    const purity = product.purity.toLowerCase()

    const category =
      categories
        .find(c => c.id === product.category_id)
        ?.name?.toLowerCase() ?? ''

    if (
      category.includes('silver') ||
      purity.includes('silver')
    ) {
      return num(rates.silver)
    }

    if (purity.includes('24'))
      return num(rates.gold_24k)

    if (purity.includes('22'))
      return num(rates.gold_22k)

    if (category.includes('gold'))
      return num(rates.gold_22k)

    return num(product.rate)
  }, [
    product.purity,
    product.category_id,
    product.rate,
    categories,
    rates,
  ])

  const metalValue =
    netWeight * applicableRate

  const wastage = useMemo(() => {
    const value = num(pricing.wastage_value)

    if (!value) return 0

    if (pricing.wastage_type === 'fixed')
      return value

    let basis = metalValue

    if (
      pricing.wastage_basis === 'net_weight'
    ) {
      basis = netWeight
    }

    if (
      pricing.wastage_basis === 'gross_weight'
    ) {
      basis = grossWeight
    }

    return (basis * value) / 100
  }, [
    pricing,
    metalValue,
    netWeight,
    grossWeight,
  ])

  const making = useMemo(() => {
    const value = num(pricing.making_value)

    if (!value) return 0

    if (pricing.making_type === 'fixed')
      return value

    if (pricing.making_type === 'percent')
      return (metalValue * value) / 100

    const basisWeight =
      pricing.making_basis === 'gross_weight'
        ? grossWeight
        : netWeight

    return basisWeight * value
  }, [
    pricing,
    metalValue,
    netWeight,
    grossWeight,
  ])

  const stoneTotal = useMemo(
    () =>
      pricing.stones.reduce(
        (sum, row) =>
          sum +
          num(row.pcs) *
            num(row.price_per_pc),
        0
      ),
    [pricing.stones]
  )

  const otherTotal = useMemo(
    () =>
      pricing.other_charges.reduce(
        (sum, row) =>
          sum +
          num(row.quantity) *
            num(row.price_per_unit),
        0
      ),
    [pricing.other_charges]
  )

  const directPiecePrice = num(product.price)

  const subtotal =
    metalValue +
    wastage +
    making +
    stoneTotal +
    otherTotal

  const gst =
    (subtotal * num(pricing.gst_percent)) /
    100

  const estimatedTotal =
    subtotal + gst

  // MULTIPLE IMAGE SELECT
  function chooseImages(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      e.target.files ?? []
    )

    if (!files.length) return

    const validFiles: File[] = []

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        showPopup(
          'error',
          'Invalid Image',
          `"${file.name}" is not a valid image file.`
        )
        continue
      }

      if (file.size > 8 * 1024 * 1024) {
        showPopup(
          'error',
          'Image Too Large',
          `"${file.name}" is larger than 8 MB.`
        )
        continue
      }

      validFiles.push(file)
    }

    if (!validFiles.length) return

    // Purane selected files ke saath naye files add honge
    setImageFiles(prev => [
      ...prev,
      ...validFiles,
    ])

    const newPreviews = validFiles.map(file =>
      URL.createObjectURL(file)
    )

    setImagePreviews(prev => [
      ...prev,
      ...newPreviews,
    ])

    // Same file dobara select karne ki permission
    e.target.value = ''
  }

  function removeSelectedImage(index: number) {
    const preview = imagePreviews[index]

    if (preview) {
      URL.revokeObjectURL(preview)
    }

    setImageFiles(prev =>
      prev.filter((_, i) => i !== index)
    )

    setImagePreviews(prev =>
      prev.filter((_, i) => i !== index)
    )
  }

  async function deleteExistingProductImage(image: ExistingProductImage) {
    if (
      !confirm(
        'Delete this saved photo?\\n\\nThis photo will be permanently removed from the product.'
      )
    ) {
      return
    }

    setBusy(true)

    try {
      if (image.storage_path) {
        const storageDelete = await supabase.storage
          .from(BUCKET)
          .remove([image.storage_path])

        if (storageDelete.error) {
          showPopup(
            'error',
            'Photo Delete Failed',
            errorText(storageDelete.error)
          )
          return
        }
      }

      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', image.id)

      if (error) {
        showPopup(
          'error',
          'Photo Delete Failed',
          errorText(error)
        )
        return
      }

      setExistingProductImages(prev =>
        prev.filter(item => item.id !== image.id)
      )

      showPopup(
        'success',
        'Photo Deleted',
        'The selected product photo was deleted successfully.'
      )
    } catch (error) {
      showPopup(
        'error',
        'Photo Delete Error',
        errorText(error)
      )
    } finally {
      setBusy(false)
    }
  }

  function resetProduct() {
    setProduct(emptyProduct)
    setPricing(emptyPricing)
    setSlugManuallyEdited(false)
    setAutoSlug(true)
    setImageFiles([])
    setExistingProductImages([])

    imagePreviews.forEach(preview =>
      URL.revokeObjectURL(preview)
    )

    setImagePreviews([])
  }

  function updatePricing<K extends keyof PricingDetails>(
    key: K,
    value: PricingDetails[K]
  ) {
    setPricing(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  function addStone() {
    setPricing(prev => ({
      ...prev,
      stones: [
        ...prev.stones,
        {
          id: uid(),
          stone_name: '',
          size: '',
          quality: '',
          pcs: '1',
          price_per_pc: '0',
          weight: '0',
        },
      ],
    }))
  }

  function updateStone(
    id: string,
    key: keyof StoneRow,
    value: string
  ) {
    setPricing(prev => ({
      ...prev,
      stones: prev.stones.map(row =>
        row.id === id
          ? {
              ...row,
              [key]: value,
            }
          : row
      ),
    }))
  }

  function removeStone(id: string) {
    setPricing(prev => ({
      ...prev,
      stones: prev.stones.filter(
        row => row.id !== id
      ),
    }))
  }

  function addOtherCharge() {
    setPricing(prev => ({
      ...prev,
      other_charges: [
        ...prev.other_charges,
        {
          id: uid(),
          charge_type:
            chargeTypes[0] ?? 'Other',
          description: '',
          quantity: '1',
          price_per_unit: '0',
        },
      ],
    }))
  }

  function updateOther(
    id: string,
    key: keyof OtherRow,
    value: string
  ) {
    setPricing(prev => ({
      ...prev,
      other_charges:
        prev.other_charges.map(row =>
          row.id === id
            ? {
                ...row,
                [key]: value,
              }
            : row
        ),
    }))
  }

  function removeOther(id: string) {
    setPricing(prev => ({
      ...prev,
      other_charges:
        prev.other_charges.filter(
          row => row.id !== id
        ),
    }))
  }

  async function addChargeType() {
    const name = newChargeType.trim()

    if (!name) {
      showPopup(
        'warning',
        'Charge Type Missing',
        'Please enter a charge type name.'
      )
      return
    }

    setBusy(true)

    try {
      const { error } = await supabase
        .from('other_charge_types')
        .insert({ name })

      if (error) {
        showPopup(
          'error',
          'Could Not Add Charge Type',
          errorText(error)
        )
        return
      }

      setNewChargeType('')
      await load()

      showPopup(
        'success',
        'Charge Type Added',
        `"${name}" is now available in Other Charges.`
      )
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings(
    e: FormEvent
  ) {
    e.preventDefault()

    if (!settings) return

    setBusy(true)

    try {
      const { error } =
        await supabase
          .from('shop_settings')
          .update({
            shop_name: settings.shop_name,
            address: settings.address,
            phone: settings.phone,
            whatsapp_number:
              settings.whatsapp_number,
            google_maps_url:
              settings.google_maps_url,
            about: settings.about,
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', 1)

      if (error) {
        showPopup(
          'error',
          'Shop Details Not Saved',
          errorText(error)
        )
        return
      }

      showPopup(
        'success',
        'Shop Details Saved',
        'Your shop details were updated successfully.'
      )

      router.refresh()
    } catch (error) {
      showPopup(
        'error',
        'Shop Details Error',
        errorText(error)
      )
    } finally {
      setBusy(false)
    }
  }

  async function saveRates() {
    setRatesBusy(true)

    try {
      const payload = {
        id: 1,
        gold_24k:
          rates.gold_24k === ''
            ? null
            : Number(rates.gold_24k),

        gold_22k:
          rates.gold_22k === ''
            ? null
            : Number(rates.gold_22k),

        silver:
          rates.silver === ''
            ? null
            : Number(rates.silver),

        updated_at:
          new Date().toISOString(),
      }

      const { error } =
        await supabase
          .from('metal_rates')
          .upsert(payload, {
            onConflict: 'id',
          })

      if (error) {
        showPopup(
          'error',
          'Metal Rates Not Saved',
          errorText(error)
        )
        return
      }

      showPopup(
        'success',
        'Metal Rates Saved',
        'Today’s metal rates were saved successfully.'
      )
    } catch (error) {
      showPopup(
        'error',
        'Metal Rates Error',
        errorText(error)
      )
    } finally {
      setRatesBusy(false)
    }
  }

  function pricingPayload() {
    return {
      pricing_mode: pricing.pricing_mode,

      gross_weight:
        pricing.gross_weight,

      stone_weight:
        String(calculatedStoneWeight),

      net_weight:
        String(netWeight),

      wastage_value:
        pricing.wastage_value,

      wastage_type:
        pricing.wastage_type,

      wastage_basis:
        pricing.wastage_basis,

      making_value:
        pricing.making_value,

      making_type:
        pricing.making_type,

      making_basis:
        pricing.making_basis,

      gst_percent:
        pricing.gst_percent,

      stones:
        pricing.stones,

      other_charges:
        pricing.other_charges,

      calculated: {
        applicable_rate:
          applicableRate,

        metal_value:
          metalValue,

        wastage,

        making,

        stone_total:
          stoneTotal,

        other_total:
          otherTotal,

        subtotal,

        gst,

        estimated_total:
          estimatedTotal,
      },
    }
  }

  async function saveProduct(
    e: FormEvent
  ) {
    e.preventDefault()

    if (!canSaveProduct) {
      showPopup(
        'warning',
        'Product Name Missing',
        'Please enter a product name before saving.'
      )
      return
    }

    setBusy(true)

    try {
      const payload = {
        name: product.name.trim(),

        slug: (
          product.slug.trim() ||
          slugify(product.name)
        ).trim(),

        sku:
          product.sku.trim() || null,

        category_id:
          product.category_id || null,

        rate:
          product.rate.trim() || null,

        weight:
          pricing.gross_weight.trim() || null,

        price:
          pricing.pricing_mode === 'piece'
            ? num(product.price) || null
            : null,

        purity:
          product.purity.trim() || null,

        description:
          product.description.trim() || null,

        is_available:
          product.is_available && num(product.stock_quantity) > 0,

        is_featured:
          product.is_featured,

        stock_quantity: Math.max(
          0,
          Math.floor(num(product.stock_quantity))
        ),

        gross_weight:
          grossWeight || null,

        stone_weight:
          calculatedStoneWeight || 0,

        net_weight:
          netWeight || 0,

        wastage_value:
          num(pricing.wastage_value) || 0,

        wastage_type:
          pricing.wastage_type,

        wastage_basis:
          pricing.wastage_basis,

        making_value:
          num(pricing.making_value) || 0,

        making_type:
          pricing.making_type,

        making_basis:
          pricing.making_basis,

        gst_percent:
          num(pricing.gst_percent) || 0,

        pricing_details:
          pricingPayload(),

        updated_at:
          new Date().toISOString(),
      }

      const duplicateQuery =
        product.id
          ? await supabase
              .from('products')
              .select('id')
              .eq('slug', payload.slug)
              .neq('id', product.id)
              .maybeSingle()
          : await supabase
              .from('products')
              .select('id')
              .eq('slug', payload.slug)
              .maybeSingle()

      if (duplicateQuery.error) {
        showPopup(
          'error',
          'Slug Check Failed',
          errorText(
            duplicateQuery.error
          )
        )
        return
      }

      if (duplicateQuery.data) {
        showPopup(
          'warning',
          'Duplicate Slug',
          'This slug is already used by another product.\n\nPlease edit the slug and try again.'
        )
        return
      }

      const result = product.id
        ? await supabase
            .from('products')
            .update(payload)
            .eq('id', product.id)
            .select('id')
            .single()
        : await supabase
            .from('products')
            .insert(payload)
            .select('id')
            .single()

      if (
        result.error ||
        !result.data
      ) {
        showPopup(
          'error',
          product.id
            ? 'Product Update Failed'
            : 'Product Add Failed',

          errorText(
            result.error,
            'The database did not return the saved product ID.'
          )
        )

        return
      }

      const productId =
        String(result.data.id)

      // ==========================================
      // MULTIPLE PRODUCT IMAGE UPLOAD
      // ==========================================

      if (imageFiles.length > 0) {
        let uploadedCount = 0

        for (
          let index = 0;
          index < imageFiles.length;
          index++
        ) {
          const imageFile =
            imageFiles[index]

          const safeName =
            imageFile.name
              .toLowerCase()
              .replace(
                /[^a-z0-9._-]+/g,
                '-'
              )
              .replace(
                /^-+|-+$/g,
                ''
              )

          const path =
            `${productId}/${crypto.randomUUID()}-${safeName || `image-${index + 1}.jpg`}`

          const upload =
            await supabase.storage
              .from(BUCKET)
              .upload(
                path,
                imageFile,
                {
                  cacheControl: '3600',
                  upsert: false,
                  contentType:
                    imageFile.type,
                }
              )

          if (upload.error) {
            showPopup(
              'error',
              'Product Saved, Some Images Failed',

              `Product information was saved.\n\n${uploadedCount} image(s) uploaded successfully.\n\nImage ${index + 1} could not be uploaded.\n\n${errorText(upload.error)}`
            )

            await load()
            return
          }

          const { data: publicData } =
            supabase.storage
              .from(BUCKET)
              .getPublicUrl(path)

          const imageInsert =
            await supabase
              .from('product_images')
              .insert({
                product_id:
                  productId,

                storage_path:
                  path,

                public_url:
                  publicData.publicUrl,

                sort_order:
                  index,
              })

          if (imageInsert.error) {
            showPopup(
              'error',
              'Product Saved, Image Record Failed',

              `Product was saved and ${uploadedCount} image(s) were uploaded.\n\nImage ${index + 1} record could not be created.\n\n${errorText(imageInsert.error)}`
            )

            await load()
            return
          }

          uploadedCount++
        }
      }

      const wasUpdate =
        Boolean(product.id)

      await load()
      resetProduct()

      showPopup(
        'success',

        wasUpdate
          ? 'Product Updated Successfully'
          : 'Product Added Successfully',

        wasUpdate
          ? imageFiles.length > 0
            ? `Product, pricing details and ${imageFiles.length} new image(s) were updated successfully.`
            : 'The product, pricing details and other saved information were updated successfully.'

          : imageFiles.length > 0
            ? `The new product and its pricing details were added successfully with ${imageFiles.length} image(s).`
            : 'The new product and its pricing details were added successfully.'
      )
    } catch (error) {
      showPopup(
        'error',
        'Unexpected Save Error',
        errorText(error)
      )
    } finally {
      setBusy(false)
    }
  }

  async function editProduct(
    p: Product
  ) {
    const raw =
      (
        p as Product & {
          pricing_details?: PricingDetails
        }
      ).pricing_details

    setSlugManuallyEdited(true)
    setAutoSlug(false)

    // New selected images reset
    imagePreviews.forEach(preview =>
      URL.revokeObjectURL(preview)
    )

    setImageFiles([])
    setImagePreviews([])

    const { data: savedImages, error: savedImagesError } = await supabase
      .from('product_images')
      .select('id, storage_path, public_url, sort_order')
      .eq('product_id', p.id)
      .order('sort_order', { ascending: true })

    if (savedImagesError) {
      setExistingProductImages([])
      showPopup(
        'warning',
        'Product Photos Load Failed',
        errorText(savedImagesError)
      )
    } else {
      setExistingProductImages(
        (savedImages as ExistingProductImage[]) ?? []
      )
    }

    const existingNetWeight = raw
      ? num(raw.net_weight)
      : num((p as Product & { net_weight?: number }).net_weight)

    const inferredPiecePrice =
      num(p.price) > 0
        ? num(p.price)
        : existingNetWeight <= 0
          ? num(p.rate)
          : 0

    const inferredPricingMode =
      raw?.pricing_mode === 'piece'
        ? 'piece'
        : raw?.pricing_mode === 'metal_rate'
          ? 'metal_rate'
          : inferredPiecePrice > 0 && existingNetWeight <= 0
            ? 'piece'
            : 'metal_rate'

    setProduct({
      ...emptyProduct,

      id: String(p.id),

      name:
        p.name ?? '',

      slug:
        p.slug ?? '',

      sku:
        p.sku ?? '',

      category_id:
        p.category_id ?? '',

      rate:
        p.rate ?? '',

      weight:
        p.weight ?? '',

      price:
        inferredPiecePrice > 0
          ? String(inferredPiecePrice)
          : '',

      purity:
        p.purity ?? '',

      description:
        p.description ?? '',

      is_available:
        p.is_available,

      is_featured:
        p.is_featured,

      stock_quantity:
        String(Math.max(0, Math.floor(num((p as Product).stock_quantity)))),
    })

    if (raw) {
      setPricing({
        ...emptyPricing,
        ...raw,
        pricing_mode: inferredPricingMode,


        stones:
          Array.isArray(raw.stones)
            ? raw.stones
            : [],

        other_charges:
          Array.isArray(
            raw.other_charges
          )
            ? raw.other_charges
            : [],
      })
    } else {
      const extended =
        p as Product & {
          gross_weight?: number
          stone_weight?: number
          net_weight?: number
        }

      setPricing({
        ...emptyPricing,
        pricing_mode: inferredPricingMode,

        gross_weight:
          extended.gross_weight
            ? String(
                extended.gross_weight
              )
            : p.weight ?? '',

        stone_weight:
          String(
            extended.stone_weight ??
              0
          ),

        net_weight:
          String(
            extended.net_weight ??
              ''
          ),
      })
    }

    window.scrollTo({
      top:
        document.body.scrollHeight /
        2,

      behavior: 'smooth',
    })
  }

  async function logStockChange(
    productId: string,
    previousStock: number,
    newStock: number,
    changeType: StockHistoryRow['change_type'],
    note: string
  ) {
    const quantityChange = newStock - previousStock

    // The existing Supabase stock_history table uses:
    // action + quantity_change + quantity_after.
    // Keep the current History UI unchanged by mapping to that schema here.
    const action =
      changeType === 'sold'
        ? 'sale'
        : changeType === 'set'
          ? 'edit'
          : changeType

    const { error } = await supabase
      .from('stock_history')
      .insert({
        product_id: productId,
        action,
        quantity_change: quantityChange,
        quantity_after: newStock,
        note,
      })

    if (error) {
      showPopup(
        'warning',
        'Stock Updated, History Not Saved',
        `Stock was updated successfully, but the history entry could not be saved.\n\n${errorText(error)}`
      )
      return false
    }

    return true
  }

  async function addOnePiece(p: Product) {
    const currentStock = Math.max(
      0,
      Math.floor(num(p.stock_quantity))
    )
    const nextStock = currentStock + 1

    setBusy(true)

    try {
      const { error } = await supabase
        .from('products')
        .update({
          stock_quantity: nextStock,
          is_available: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.id)

      if (error) {
        showPopup(
          'error',
          'Stock Update Failed',
          errorText(error)
        )
        return
      }

      await logStockChange(
        String(p.id),
        currentStock,
        nextStock,
        'add',
        '+1 PC added from Admin Product List.'
      )

      await load()

      showPopup(
        'success',
        'Stock Increased',
        `"${p.name}" now has ${nextStock} PCS available.`
      )
    } catch (error) {
      showPopup(
        'error',
        'Stock Update Failed',
        errorText(error)
      )
    } finally {
      setBusy(false)
    }
  }

  async function removeOnePiece(p: Product) {
    const currentStock = Math.max(
      0,
      Math.floor(num(p.stock_quantity))
    )

    if (currentStock <= 0) {
      showPopup(
        'warning',
        'Already Out of Stock',
        'This product already has 0 PCS available.'
      )
      return
    }

    const nextStock = currentStock - 1

    if (!confirm(`Remove 1 PC from "${p.name}"?\n\nStock will change from ${currentStock} PCS to ${nextStock} PCS.`)) {
      return
    }

    setBusy(true)

    try {
      const { error } = await supabase
        .from('products')
        .update({
          stock_quantity: nextStock,
          is_available: nextStock > 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.id)

      if (error) {
        showPopup(
          'error',
          'Stock Update Failed',
          errorText(error)
        )
        return
      }

      await logStockChange(
        String(p.id),
        currentStock,
        nextStock,
        'remove',
        '-1 PC removed from Admin Product List.'
      )

      await load()

      showPopup(
        'success',
        'Stock Decreased',
        `"${p.name}" now has ${nextStock} PCS available.`
      )
    } catch (error) {
      showPopup(
        'error',
        'Stock Update Failed',
        errorText(error)
      )
    } finally {
      setBusy(false)
    }
  }

  async function showStockHistory(p: Product) {
    setHistoryProduct(p)
    setHistoryRows([])
    setHistoryBusy(true)

    try {
      const { data, error } = await supabase
        .from('stock_history')
        .select('id, product_id, action, quantity_change, quantity_after, note, created_at')
        .eq('product_id', p.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        showPopup(
          'error',
          'History Load Failed',
          errorText(error)
        )
        setHistoryProduct(null)
        return
      }

      // Convert the existing database schema into the format used by
      // the current History UI. No new database columns are required.
      const rows = ((data ?? []) as Array<{
        id: string | number
        product_id: string
        action: string
        quantity_change: number
        quantity_after: number
        note: string | null
        created_at: string
      }>).map(row => {
        const changeType: StockHistoryRow['change_type'] =
          row.action === 'sale'
            ? 'sold'
            : row.action === 'add'
              ? 'add'
              : row.action === 'remove'
                ? 'remove'
                : 'set'

        const quantityChange = Number(row.quantity_change ?? 0)
        const newStock = Number(row.quantity_after ?? 0)
        const previousStock = newStock - quantityChange

        return {
          id: row.id,
          product_id: String(row.product_id),
          change_type: changeType,
          previous_stock: previousStock,
          new_stock: newStock,
          quantity_change: quantityChange,
          note: row.note ?? null,
          created_at: row.created_at,
        }
      })

      setHistoryRows(rows)
    } catch (error) {
      showPopup(
        'error',
        'History Load Failed',
        errorText(error)
      )
      setHistoryProduct(null)
    } finally {
      setHistoryBusy(false)
    }
  }

  async function markOneSold(p: Product) {
    const currentStock = Math.max(
      0,
      Math.floor(num(p.stock_quantity))
    )

    if (currentStock <= 0) {
      showPopup(
        'warning',
        'Already Out of Stock',
        'This product already has 0 PCS available.'
      )
      return
    }

    if (!confirm(`Mark 1 PCS of "${p.name}" as sold?\n\nStock will change from ${currentStock} PCS to ${currentStock - 1} PCS.`)) {
      return
    }

    setBusy(true)

    try {
      const nextStock = currentStock - 1

      const { error } = await supabase
        .from('products')
        .update({
          stock_quantity: nextStock,
          is_available: nextStock > 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.id)

      if (error) {
        showPopup(
          'error',
          'Stock Update Failed',
          errorText(error)
        )
        return
      }

      await logStockChange(
        String(p.id),
        currentStock,
        nextStock,
        'sold',
        '1 PC marked as sold from Admin Product List.'
      )

      await load()

      showPopup(
        'success',
        nextStock > 0 ? 'Stock Updated' : 'Product Sold Out',
        nextStock > 0
          ? `"${p.name}" now has ${nextStock} PCS available.`
          : `"${p.name}" is now Out of Stock.`
      )
    } catch (error) {
      showPopup(
        'error',
        'Stock Update Failed',
        errorText(error)
      )
    } finally {
      setBusy(false)
    }
  }

  async function removeProduct(
    id: string
  ) {
    if (
      !confirm(
        'Delete this product?'
      )
    ) {
      return
    }

    setBusy(true)

    try {
      const {
        data: images,
        error: imageListError,
      } = await supabase
        .from('product_images')
        .select('storage_path')
        .eq('product_id', id)

      if (imageListError) {
        showPopup(
          'error',
          'Delete Failed',
          errorText(
            imageListError
          )
        )
        return
      }

      if (images?.length) {
        const storageDelete =
          await supabase.storage
            .from(BUCKET)
            .remove(
              images.map(
                x => x.storage_path
              )
            )

        if (storageDelete.error) {
          showPopup(
            'error',
            'Image Delete Failed',
            errorText(
              storageDelete.error
            )
          )
          return
        }
      }

      const imageDelete =
        await supabase
          .from('product_images')
          .delete()
          .eq('product_id', id)

      if (imageDelete.error) {
        showPopup(
          'error',
          'Image Record Delete Failed',
          errorText(
            imageDelete.error
          )
        )
        return
      }

      const { error } =
        await supabase
          .from('products')
          .delete()
          .eq('id', id)

      if (error) {
        showPopup(
          'error',
          'Product Delete Failed',
          errorText(error)
        )
        return
      }

      await load()

      showPopup(
        'success',
        'Product Deleted',
        'The product was deleted successfully.'
      )
    } catch (error) {
      showPopup(
        'error',
        'Delete Error',
        errorText(error)
      )
    } finally {
      setBusy(false)
    }
  }

  async function addCategory() {
    const name =
      newCategory.trim()

    if (!name) {
      showPopup(
        'warning',
        'Category Name Missing',
        'Please enter a category name.'
      )
      return
    }

    setBusy(true)

    try {
      const slug =
        slugify(name)

      const sort_order =
        categories.length
          ? Math.max(
              ...categories.map(
                c => c.sort_order
              )
            ) + 1
          : 1

      const { error } =
        await supabase
          .from('categories')
          .insert({
            name,
            slug,
            sort_order,
          })

      if (error) {
        showPopup(
          'error',
          'Category Add Failed',
          errorText(error)
        )
        return
      }

      setNewCategory('')
      await load()

      showPopup(
        'success',
        'Category Added',
        `"${name}" was added successfully.`
      )
    } finally {
      setBusy(false)
    }
  }

  async function updateCategory(
    id: string
  ) {
    const name =
      editingCategoryName.trim()

    if (!name) {
      showPopup(
        'warning',
        'Category Name Missing',
        'Please enter a category name.'
      )
      return
    }

    setBusy(true)

    try {
      const { error } =
        await supabase
          .from('categories')
          .update({
            name,
            slug: slugify(name),
          })
          .eq('id', id)

      if (error) {
        showPopup(
          'error',
          'Category Update Failed',
          errorText(error)
        )
        return
      }

      setEditingCategoryId(null)
      setEditingCategoryName('')

      await load()

      showPopup(
        'success',
        'Category Updated',
        'The category was updated successfully.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function removeCategory(
    id: string
  ) {
    if (
      !confirm(
        'Delete this category? Products already using it may prevent deletion.'
      )
    ) {
      return
    }

    setBusy(true)

    try {
      const { error } =
        await supabase
          .from('categories')
          .delete()
          .eq('id', id)

      if (error) {
        showPopup(
          'error',
          'Category Delete Failed',
          errorText(error)
        )
        return
      }

      await load()

      showPopup(
        'success',
        'Category Deleted',
        'The category was deleted successfully.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/admin/login')
    router.refresh()
  }

  if (!ready) {
    return (
      <main className="min-h-svh p-8 text-center">
        Loading owner dashboard…
      </main>
    )
  }

  if (!authorized) return null

  return (
    <>
      {historyProduct && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">
                  Stock History
                </p>
                <h3 className="mt-1 text-xl font-semibold text-primary">
                  {historyProduct.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Current stock: {num(historyProduct.stock_quantity)} PCS
                </p>
              </div>

              <button
                type="button"
                onClick={() => setHistoryProduct(null)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
              >
                Close
              </button>
            </div>

            <div className="mt-5 max-h-[60vh] overflow-y-auto rounded-xl border">
              {historyBusy ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Loading history…
                </div>
              ) : historyRows.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="font-medium">No stock history yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Future +1 PC, -1 PC and sold changes will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {historyRows.map(row => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {row.change_type === 'add'
                            ? '+1 PC Added'
                            : row.change_type === 'remove'
                              ? '-1 PC Removed'
                              : row.change_type === 'sold'
                                ? '1 PC Sold'
                                : 'Stock Updated'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.note || 'Stock change'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(row.created_at).toLocaleString('en-IN')}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-sm font-medium">
                          {row.previous_stock} PCS → {row.new_stock} PCS
                        </p>
                        <p className={cn(
                          'text-xs font-medium',
                          row.quantity_change > 0
                            ? 'text-green-600'
                            : row.quantity_change < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        )}>
                          {row.quantity_change > 0 ? '+' : ''}
                          {row.quantity_change} PCS
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {popup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <div
              className={`flex size-14 items-center justify-center rounded-full text-2xl ${
                popup.type === 'success'
                  ? 'bg-green-100 text-green-700'
                  : popup.type === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {popup.type === 'success'
                ? '✓'
                : popup.type === 'error'
                  ? '!'
                  : '⚠'}
            </div>

            <h3 className="mt-4 text-xl font-semibold text-primary">
              {popup.title}
            </h3>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {popup.message}
            </p>

            <button
              type="button"
              onClick={() =>
                setPopup(null)
              }
              className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <main className="min-h-svh bg-secondary/30 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-6xl">

          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gold">
                LEELA JEWELLERS
              </p>

              <h1 className="font-serif text-3xl font-semibold text-primary">
                Owner Dashboard
              </h1>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  router.push('/')
                }
                className="rounded-md border px-4 py-2 text-sm"
              >
                View website
              </button>

              <button
                onClick={signOut}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              >
                Logout
              </button>
            </div>
          </header>

          {message && (
            <div className="mb-4 rounded-md border bg-background px-4 py-3 text-sm">
              {message}
            </div>
          )}

          {/* SHOP DETAILS */}

          <section className="mb-6 rounded-2xl border border-border bg-background p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">
                  Store Information
                </p>
                <h2 className="font-serif text-2xl font-semibold text-primary">
                  Shop Details
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowShopDetails(value => !value)}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-secondary"
              >
                {showShopDetails ? 'Hide Shop Details' : 'View Shop Details'}
              </button>
            </div>

            {showShopDetails && (
              <form
                onSubmit={saveSettings}
                className="mt-5 grid gap-4 md:grid-cols-2"
              >
                {settings && (
                  <>
                    {([
                      ['shop_name', 'Shop name'],
                      ['phone', 'Mobile number'],
                      ['whatsapp_number', 'WhatsApp number'],
                      ['address', 'Address'],
                      ['google_maps_url', 'Google Maps URL'],
                    ] as const).map(
                      ([key, label]) => (
                        <label
                          key={key}
                          className="text-sm font-medium"
                        >
                          {label}

                          <input
                            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                            value={
                              (settings as any)[key] ??
                              ''
                            }
                            onChange={e =>
                              setSettings({
                                ...settings,
                                [key]:
                                  e.target.value,
                              })
                            }
                          />
                        </label>
                      )
                    )}

                    <label className="text-sm font-medium md:col-span-2">
                      About

                      <textarea
                        className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2"
                        value={
                          settings.about ?? ''
                        }
                        onChange={e =>
                          setSettings({
                            ...settings,
                            about:
                              e.target.value,
                          })
                        }
                      />
                    </label>
                  </>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground md:w-fit"
                >
                  Save shop details
                </button>
              </form>
            )}
          </section>

          {/* METAL RATES */}

          <section className="mb-6 rounded-2xl border border-border bg-background p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">
                  Market Rates
                </p>

                <h2 className="font-serif text-2xl font-semibold text-primary">
                  Daily Metal Rates
                </h2>
              </div>

              <p className="text-xs text-muted-foreground">
                Update whenever your shop's current rates change.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium">
                Gold 24K (₹/gram)

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={
                    rates.gold_24k
                  }
                  onChange={e =>
                    setRates({
                      ...rates,
                      gold_24k:
                        e.target.value,
                    })
                  }
                />
              </label>

              <label className="text-sm font-medium">
                Gold 22K (₹/gram)

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={
                    rates.gold_22k
                  }
                  onChange={e =>
                    setRates({
                      ...rates,
                      gold_22k:
                        e.target.value,
                    })
                  }
                />
              </label>

              <label className="text-sm font-medium">
                Silver (₹/gram)

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={
                    rates.silver
                  }
                  onChange={e =>
                    setRates({
                      ...rates,
                      silver:
                        e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <button
              type="button"
              disabled={ratesBusy}
              onClick={saveRates}
              className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
            >
              {ratesBusy
                ? 'Saving…'
                : 'Save metal rates'}
            </button>
          </section>

          {/* CATEGORIES */}

          <section className="mb-6 rounded-2xl border border-border bg-background p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">
                  Catalogue
                </p>

                <h2 className="font-serif text-2xl font-semibold text-primary">
                  Categories
                </h2>
              </div>

              <div className="flex w-full gap-2 sm:w-auto">
                <input
                  className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm sm:w-64"
                  placeholder="New category name"
                  value={
                    newCategory
                  }
                  onChange={e =>
                    setNewCategory(
                      e.target.value
                    )
                  }
                />

                <button
                  type="button"
                  disabled={
                    busy ||
                    !newCategory.trim()
                  }
                  onClick={
                    addCategory
                  }
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  {editingCategoryId ===
                  c.id ? (
                    <div className="flex min-w-0 flex-1 gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm"
                        value={
                          editingCategoryName
                        }
                        onChange={e =>
                          setEditingCategoryName(
                            e.target.value
                          )
                        }
                      />

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          updateCategory(
                            c.id
                          )
                        }
                        className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate text-sm font-medium">
                        {c.name}
                      </span>

                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingCategoryId(
                              c.id
                            )
                            setEditingCategoryName(
                              c.name
                            )
                          }}
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            removeCategory(
                              c.id
                            )
                          }
                          className="rounded-md border px-2 py-1 text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              You can add more categories anytime.
            </p>
          </section>

          {/* ADD / EDIT PRODUCT */}

          <section className="mb-6 rounded-2xl border border-border bg-background p-5">
            <h2 className="font-serif text-2xl font-semibold text-primary">
              {product.id
                ? 'Edit Product'
                : 'Add Product'}
            </h2>

            <form
              onSubmit={saveProduct}
              className="mt-4 space-y-6"
            >

              {/* BASIC PRODUCT DETAILS */}

              <div className="grid gap-4 md:grid-cols-2">

                <label className="text-sm font-medium">
                  Product name

                  <input
                    required
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={
                      product.name
                    }
                    onChange={e => {
                      const name =
                        e.target.value

                      setProduct({
                        ...product,
                        name,

                        slug:
                          autoSlug &&
                          !slugManuallyEdited
                            ? slugify(name)
                            : product.slug,
                      })
                    }}
                  />
                </label>

                <label className="text-sm font-medium">
                  SKU

                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={
                      product.sku
                    }
                    onChange={e =>
                      setProduct({
                        ...product,
                        sku:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label className="text-sm font-medium">
                  Category

                  <select
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={
                      product.category_id
                    }
                    onChange={e =>
                      setProduct({
                        ...product,
                        category_id:
                          e.target.value,
                      })
                    }
                  >
                    <option value="">
                      Select category
                    </option>

                    {categories.map(
                      c => (
                        <option
                          key={c.id}
                          value={c.id}
                        >
                          {c.name}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="text-sm font-medium">
                  Purity

                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={
                      product.purity
                    }
                    onChange={e =>
                      setProduct({
                        ...product,
                        purity:
                          e.target.value,
                      })
                    }
                    placeholder="22K"
                  />
                </label>

                <label className="text-sm font-medium">
                  Slug

                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2"
                    value={
                      product.slug
                    }
                    onChange={e => {
                      setSlugManuallyEdited(
                        true
                      )

                      setAutoSlug(
                        false
                      )

                      setProduct({
                        ...product,
                        slug:
                          e.target.value,
                      })
                    }}
                  />

                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {autoSlug
                      ? 'Automatic: generated from Product Name.'
                      : 'Manual: you can edit the slug yourself.'}
                  </span>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border px-3 py-1.5 text-xs"
                      onClick={() => {
                        setSlugManuallyEdited(
                          false
                        )

                        setAutoSlug(
                          true
                        )

                        setProduct(
                          prev => ({
                            ...prev,
                            slug:
                              slugify(
                                prev.name
                              ),
                          })
                        )
                      }}
                    >
                      Generate from name
                    </button>

                    {slugManuallyEdited && (
                      <button
                        type="button"
                        className="rounded-md border px-3 py-1.5 text-xs"
                        onClick={() => {
                          setSlugManuallyEdited(
                            false
                          )

                          setAutoSlug(
                            true
                          )

                          setProduct(
                            prev => ({
                              ...prev,
                              slug:
                                slugify(
                                  prev.name
                                ),
                            })
                          )
                        }}
                      >
                        Use automatic slug
                      </button>
                    )}
                  </div>
                </label>
              </div>

              {/* PRICING MODE */}

              <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gold">
                    Product Pricing
                  </p>
                  <h3 className="font-serif text-xl font-semibold text-primary">
                    How should this product price be shown?
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose Direct Piece Price for products with a fixed selling price. Choose Metal Rate Based for products whose price changes with the daily gold/silver rate.
                  </p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className={cn(
                    'cursor-pointer rounded-xl border p-4 transition-colors',
                    pricing.pricing_mode === 'metal_rate'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background'
                  )}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="pricing_mode"
                        value="metal_rate"
                        checked={pricing.pricing_mode === 'metal_rate'}
                        onChange={() => updatePricing('pricing_mode', 'metal_rate')}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold">Metal Rate Based</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Price is calculated from metal rate, weight, making, stones, other charges and GST.
                        </p>
                      </div>
                    </div>
                  </label>

                  <label className={cn(
                    'cursor-pointer rounded-xl border p-4 transition-colors',
                    pricing.pricing_mode === 'piece'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background'
                  )}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="pricing_mode"
                        value="piece"
                        checked={pricing.pricing_mode === 'piece'}
                        onChange={() => updatePricing('pricing_mode', 'piece')}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold">Direct Piece Price</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          This fixed price will show to customers whether today's metal rate is filled or blank.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>

                {pricing.pricing_mode === 'piece' && (
                  <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <label className="text-sm font-medium">
                      Direct Piece Price (₹)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold"
                        value={product.price}
                        onChange={e =>
                          setProduct(prev => ({
                            ...prev,
                            price: e.target.value,
                          }))
                        }
                        placeholder="e.g. 5000"
                      />
                    </label>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Customer site par ye price directly show hogi. Daily metal rate ka is price par koi effect nahi hoga.
                    </p>
                  </div>
                )}
              </section>

              {/* WEIGHT DETAILS */}

              <section className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gold">
                      Weight Details
                    </p>

                    <h3 className="font-serif text-xl font-semibold text-primary">
                      Metal & Stone Weight
                    </h3>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Net metal weight = Gross − Stone
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-medium">
                    Gross Weight (GM)

                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className="mt-1 w-full rounded-md border px-3 py-2"
                      value={
                        pricing.gross_weight
                      }
                      onChange={e =>
                        updatePricing(
                          'gross_weight',
                          e.target.value
                        )
                      }
                    />
                  </label>

                  <label className="text-sm font-medium">
                    Total Stone Weight (GM)

                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className="mt-1 w-full rounded-md border px-3 py-2"
                      value={
                        calculatedStoneWeight
                      }
                      onChange={e =>
                        updatePricing(
                          'stone_weight',
                          e.target.value
                        )
                      }
                      disabled={
                        pricing.stones
                          .length > 0
                      }
                    />

                    {pricing.stones.length >
                      0 && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Calculated from Stone rows.
                      </span>
                    )}
                  </label>

                  <div className="rounded-md border bg-secondary/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Net Metal Weight
                    </p>

                    <p className="mt-1 text-lg font-semibold">
                      {netWeight.toFixed(
                        3
                      )}{' '}
                      GM
                    </p>
                  </div>
                </div>
              </section>

              {/* MAKING & WASTAGE */}

              <section className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gold">
                  Making & Wastage
                </p>

                <h3 className="font-serif text-xl font-semibold text-primary">
                  Pricing Rules
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-2">

                  {/* MAKING */}

                  <div className="rounded-lg border p-4">
                    <p className="font-medium">
                      Making Charges
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        Value

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          value={
                            pricing.making_value
                          }
                          onChange={e =>
                            updatePricing(
                              'making_value',
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label className="text-sm">
                        Type

                        <select
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          value={
                            pricing.making_type
                          }
                          onChange={e =>
                            updatePricing(
                              'making_type',
                              e.target
                                .value as PricingDetails['making_type']
                            )
                          }
                        >
                          <option value="per_gram">
                            ₹ / Gram
                          </option>

                          <option value="percent">
                            % of Metal Value
                          </option>

                          <option value="fixed">
                            Fixed Amount
                          </option>
                        </select>
                      </label>

                      {pricing.making_type ===
                        'per_gram' && (
                        <label className="text-sm sm:col-span-2">
                          Weight Basis

                          <select
                            className="mt-1 w-full rounded-md border px-3 py-2"
                            value={
                              pricing.making_basis
                            }
                            onChange={e =>
                              updatePricing(
                                'making_basis',
                                e.target
                                  .value as PricingDetails['making_basis']
                              )
                            }
                          >
                            <option value="net_weight">
                              Net Weight
                            </option>

                            <option value="gross_weight">
                              Gross Weight
                            </option>
                          </select>
                        </label>
                      )}
                    </div>

                    <p className="mt-3 text-sm font-medium">
                      Calculated Making:{' '}
                      {money(making)}
                    </p>
                  </div>

                  {/* WASTAGE */}

                  <div className="rounded-lg border p-4">
                    <p className="font-medium">
                      Wastage / VA
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        Value

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          value={
                            pricing.wastage_value
                          }
                          onChange={e =>
                            updatePricing(
                              'wastage_value',
                              e.target.value
                            )
                          }
                        />
                      </label>

                      <label className="text-sm">
                        Type

                        <select
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          value={
                            pricing.wastage_type
                          }
                          onChange={e =>
                            updatePricing(
                              'wastage_type',
                              e.target
                                .value as PricingDetails['wastage_type']
                            )
                          }
                        >
                          <option value="percent">
                            Percent
                          </option>

                          <option value="fixed">
                            Fixed Amount
                          </option>
                        </select>
                      </label>

                      {pricing.wastage_type ===
                        'percent' && (
                        <label className="text-sm sm:col-span-2">
                          Calculation Basis

                          <select
                            className="mt-1 w-full rounded-md border px-3 py-2"
                            value={
                              pricing.wastage_basis
                            }
                            onChange={e =>
                              updatePricing(
                                'wastage_basis',
                                e.target
                                  .value as PricingDetails['wastage_basis']
                              )
                            }
                          >
                            <option value="metal_value">
                              Metal Value
                            </option>

                            <option value="net_weight">
                              Net Weight
                            </option>

                            <option value="gross_weight">
                              Gross Weight
                            </option>
                          </select>
                        </label>
                      )}
                    </div>

                    <p className="mt-3 text-sm font-medium">
                      Calculated Wastage:{' '}
                      {money(wastage)}
                    </p>
                  </div>
                </div>
              </section>

              {/* STONES */}

              <section className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gold">
                      Stone Charges
                    </p>

                    <h3 className="font-serif text-xl font-semibold text-primary">
                      Add Stones
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={addStone}
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                  >
                    + Add Stone
                  </button>
                </div>

                {pricing.stones.length ===
                0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No stones added. You can add multiple stone rows.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {pricing.stones.map(
                      (row, index) => (
                        <div
                          key={row.id}
                          className="rounded-lg border p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <p className="font-medium">
                              Stone {index + 1}
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                removeStone(
                                  row.id
                                )
                              }
                              className="rounded-md border px-2 py-1 text-xs"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="text-sm">
                              Stone Name

                              <input
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.stone_name
                                }
                                onChange={e =>
                                  updateStone(
                                    row.id,
                                    'stone_name',
                                    e.target
                                      .value
                                  )
                                }
                                placeholder="Diamond / Ruby / Emerald"
                              />
                            </label>

                            <label className="text-sm">
                              Size

                              <input
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.size
                                }
                                onChange={e =>
                                  updateStone(
                                    row.id,
                                    'size',
                                    e.target
                                      .value
                                  )
                                }
                                placeholder="3 mm"
                              />
                            </label>

                            <label className="text-sm">
                              Quality

                              <input
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.quality
                                }
                                onChange={e =>
                                  updateStone(
                                    row.id,
                                    'quality',
                                    e.target
                                      .value
                                  )
                                }
                                placeholder="Premium"
                              />
                            </label>

                            <label className="text-sm">
                              Pcs

                              <input
                                type="number"
                                min="0"
                                step="1"
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.pcs
                                }
                                onChange={e =>
                                  updateStone(
                                    row.id,
                                    'pcs',
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </label>

                            <label className="text-sm">
                              Price / Pc (₹)

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.price_per_pc
                                }
                                onChange={e =>
                                  updateStone(
                                    row.id,
                                    'price_per_pc',
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </label>

                            <label className="text-sm">
                              Stone Weight (GM)

                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.weight
                                }
                                onChange={e =>
                                  updateStone(
                                    row.id,
                                    'weight',
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </label>
                          </div>

                          <p className="mt-3 text-right text-sm font-semibold">
                            Stone Total:{' '}
                            {money(
                              num(row.pcs) *
                                num(
                                  row.price_per_pc
                                )
                            )}
                          </p>
                        </div>
                      )
                    )}

                    <div className="flex justify-between rounded-lg bg-secondary/40 p-3 text-sm font-semibold">
                      <span>
                        Total Stone Weight:{' '}
                        {calculatedStoneWeight.toFixed(
                          3
                        )}{' '}
                        GM
                      </span>

                      <span>
                        Total Stone Charges:{' '}
                        {money(
                          stoneTotal
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </section>

              {/* OTHER CHARGES */}

              <section className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gold">
                      Other Charges
                    </p>

                    <h3 className="font-serif text-xl font-semibold text-primary">
                      Add Other Charges
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={
                      addOtherCharge
                    }
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                  >
                    + Add Other
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className="min-w-52 rounded-md border px-3 py-2 text-sm"
                    value={
                      newChargeType
                    }
                    onChange={e =>
                      setNewChargeType(
                        e.target.value
                      )
                    }
                    placeholder="New charge type e.g. Polish"
                  />

                  <button
                    type="button"
                    disabled={
                      busy ||
                      !newChargeType.trim()
                    }
                    onClick={
                      addChargeType
                    }
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    + Add Charge Type
                  </button>
                </div>

                {pricing.other_charges
                  .length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No other charges added.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {pricing.other_charges.map(
                      (row, index) => (
                        <div
                          key={row.id}
                          className="rounded-lg border p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <p className="font-medium">
                              Other Charge{' '}
                              {index + 1}
                            </p>

                            <button
                              type="button"
                              onClick={() =>
                                removeOther(
                                  row.id
                                )
                              }
                              className="rounded-md border px-2 py-1 text-xs"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="text-sm">
                              Charge For

                              <select
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.charge_type
                                }
                                onChange={e =>
                                  updateOther(
                                    row.id,
                                    'charge_type',
                                    e.target
                                      .value
                                  )
                                }
                              >
                                {chargeTypes.map(
                                  type => (
                                    <option
                                      key={
                                        type
                                      }
                                      value={
                                        type
                                      }
                                    >
                                      {type}
                                    </option>
                                  )
                                )}

                                {!chargeTypes.includes(
                                  row.charge_type
                                ) && (
                                  <option
                                    value={
                                      row.charge_type
                                    }
                                  >
                                    {
                                      row.charge_type
                                    }
                                  </option>
                                )}
                              </select>
                            </label>

                            <label className="text-sm">
                              Description

                              <input
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.description
                                }
                                onChange={e =>
                                  updateOther(
                                    row.id,
                                    'description',
                                    e.target
                                      .value
                                  )
                                }
                                placeholder="Optional details"
                              />
                            </label>

                            <label className="text-sm">
                              Qty

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.quantity
                                }
                                onChange={e =>
                                  updateOther(
                                    row.id,
                                    'quantity',
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </label>

                            <label className="text-sm">
                              Price / Unit (₹)

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="mt-1 w-full rounded-md border px-3 py-2"
                                value={
                                  row.price_per_unit
                                }
                                onChange={e =>
                                  updateOther(
                                    row.id,
                                    'price_per_unit',
                                    e.target
                                      .value
                                  )
                                }
                              />
                            </label>
                          </div>

                          <p className="mt-3 text-right text-sm font-semibold">
                            Charge Total:{' '}
                            {money(
                              num(
                                row.quantity
                              ) *
                                num(
                                  row.price_per_unit
                                )
                            )}
                          </p>
                        </div>
                      )
                    )}

                    <div className="rounded-lg bg-secondary/40 p-3 text-right text-sm font-semibold">
                      Total Other Charges:{' '}
                      {money(otherTotal)}
                    </div>
                  </div>
                )}
              </section>

              {/* FINAL CALCULATION */}

              <section className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gold">
                      Final Calculation
                    </p>

                    <h3 className="font-serif text-xl font-semibold text-primary">
                      Estimated Price
                    </h3>
                  </div>

                  <label className="text-sm font-medium">
                    GST (%)

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-28 rounded-md border px-3 py-2"
                      value={
                        pricing.gst_percent
                      }
                      onChange={e =>
                        updatePricing(
                          'gst_percent',
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <div className="mt-4 space-y-2 rounded-lg border p-4 text-sm">
                  <div className="flex justify-between">
                    <span>
                      Net Metal Weight
                    </span>

                    <span>
                      {netWeight.toFixed(
                        3
                      )}{' '}
                      GM
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Applicable Metal Rate
                    </span>

                    <span>
                      {money(
                        applicableRate
                      )}{' '}
                      / GM
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Metal Value
                    </span>

                    <span>
                      {money(
                        metalValue
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Wastage / VA
                    </span>

                    <span>
                      {money(wastage)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Making Charges
                    </span>

                    <span>
                      {money(making)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Stone Charges
                    </span>

                    <span>
                      {money(
                        stoneTotal
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Other Charges
                    </span>

                    <span>
                      {money(
                        otherTotal
                      )}
                    </span>
                  </div>

                  <div className="my-2 border-t" />

                  <div className="flex justify-between font-semibold">
                    <span>
                      Subtotal
                    </span>

                    <span>
                      {money(subtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      GST (
                      {num(
                        pricing.gst_percent
                      )}
                      %)
                    </span>

                    <span>
                      {money(gst)}
                    </span>
                  </div>

                  <div className="my-2 border-t" />

                  <div className="flex justify-between text-lg font-bold text-primary">
                    <span>
                      Estimated Total
                    </span>

                    <span>
                      {money(
                        estimatedTotal
                      )}
                    </span>
                  </div>
                </div>
              </section>

              {/* DESCRIPTION */}

              <label className="text-sm font-medium">
                Description

                <textarea
                  className="mt-1 min-h-24 w-full rounded-md border px-3 py-2"
                  value={
                    product.description
                  }
                  onChange={e =>
                    setProduct({
                      ...product,
                      description:
                        e.target.value,
                    })
                  }
                />
              </label>

              {/* ========================================
                  MULTIPLE PRODUCT PHOTOS
                  ======================================== */}

              <div className="rounded-xl border border-dashed p-4">

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      Product Photos
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      You can select multiple photos for the same product.
                    </p>
                  </div>

                  {imageFiles.length >
                    0 && (
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                      {imageFiles.length}{' '}
                      photo
                      {imageFiles.length >
                      1
                        ? 's'
                        : ''}{' '}
                      selected
                    </span>
                  )}
                </div>

                <input
                  className="mt-3 block w-full text-sm"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  onChange={
                    chooseImages
                  }
                />

                <p className="mt-2 text-xs text-muted-foreground">
                  Select multiple JPG, PNG, WebP or AVIF images. Maximum 8 MB per image.
                </p>

                {/* EXISTING SAVED PHOTOS */}

                {existingProductImages.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Existing Photos
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {existingProductImages.map((image, index) => (
                        <div
                          key={image.id}
                          className="relative overflow-hidden rounded-xl border bg-secondary"
                        >
                          <img
                            src={image.public_url}
                            alt={`${product.name || 'Product'} photo ${index + 1}`}
                            className="aspect-square w-full object-cover"
                          />

                          <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                            Saved {index + 1}
                          </div>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              deleteExistingProductImage(image)
                            }
                            className="absolute right-2 top-2 rounded-full bg-red-600/90 px-2.5 py-1.5 text-xs font-medium text-white shadow hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Delete photo"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NEW IMAGE PREVIEWS */}

                {imagePreviews.length >
                  0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">

                    {imagePreviews.map(
                      (
                        preview,
                        index
                      ) => (
                        <div
                          key={
                            preview
                          }
                          className="relative overflow-hidden rounded-xl border bg-secondary"
                        >
                          <img
                            src={
                              preview
                            }
                            alt={`Selected product ${index + 1}`}
                            className="aspect-square w-full object-cover"
                          />

                          <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">
                            {index + 1}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeSelectedImage(
                                index
                              )
                            }
                            className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white hover:bg-black"
                          >
                            ✕
                          </button>
                        </div>
                      )
                    )}

                  </div>
                )}

              </div>

              {/* STOCK / AVAILABLE / FEATURED */}

              <section className="rounded-xl border p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium">
                    Available Pieces (PCS)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="mt-1 w-full rounded-md border px-3 py-2"
                      value={product.stock_quantity}
                      onChange={e => {
                        const value = Math.max(0, Math.floor(num(e.target.value)))
                        setProduct(prev => ({
                          ...prev,
                          stock_quantity: String(value),
                          is_available: value > 0 ? prev.is_available : false,
                        }))
                      }}
                    />
                    <span className="mt-1 block text-xs text-muted-foreground">
                      0 PCS automatically saves the product as Out of Stock.
                    </span>
                  </label>

                  <div className="rounded-md border bg-secondary/30 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Current Stock Status</p>
                    <p className="mt-1 font-semibold">
                      {num(product.stock_quantity) > 0 && product.is_available
                        ? `Available · ${num(product.stock_quantity)} PCS`
                        : 'Out of Stock'}
                    </p>
                  </div>
                </div>
              </section>

              {/* AVAILABLE / FEATURED */}

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      product.is_available
                    }
                    onChange={e =>
                      setProduct({
                        ...product,
                        is_available:
                          e.target
                            .checked,
                      })
                    }
                  />

                  Available
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      product.is_featured
                    }
                    onChange={e =>
                      setProduct({
                        ...product,
                        is_featured:
                          e.target
                            .checked,
                      })
                    }
                  />

                  Featured
                </label>
              </div>

              {/* SAVE BUTTONS */}

              <div className="flex gap-2">
                <button
                  disabled={
                    busy ||
                    !canSaveProduct
                  }
                  className="rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                >
                  {busy
                    ? 'Saving…'
                    : product.id
                      ? 'Update product'
                      : 'Add product'}
                </button>

                {product.id && (
                  <button
                    type="button"
                    onClick={
                      resetProduct
                    }
                    className="rounded-md border px-4 py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>

            </form>
          </section>

          {/* PRODUCTS LIST */}

          <section className="rounded-2xl border border-border bg-background p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">
                  Catalogue Management
                </p>
                <h2 className="font-serif text-2xl font-semibold text-primary">
                  Products
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search, filter and sort your jewellery products quickly.
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredProducts.length}</span> of {products.length}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium lg:col-span-2">
                Search products
                <input
                  type="search"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Search by name, SKU, purity or slug..."
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                />
              </label>

              <label className="text-sm font-medium">
                Category
                <select
                  value={productCategoryFilter}
                  onChange={e => setProductCategoryFilter(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="">All categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Status
                <select
                  value={productStatusFilter}
                  onChange={e => setProductStatusFilter(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="all">All products</option>
                  <option value="available">Available</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="featured">Featured</option>
                </select>
              </label>

              <label className="text-sm font-medium md:col-span-2 lg:col-span-3">
                Sort by
                <select
                  value={productSort}
                  onChange={e => setProductSort(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  <option value="newest">Newest first</option>
                  <option value="name_asc">Name: A → Z</option>
                  <option value="name_desc">Name: Z → A</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                  <option value="weight_asc">Weight: Low → High</option>
                  <option value="weight_desc">Weight: High → Low</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setProductSearch('')
                    setProductCategoryFilter('')
                    setProductStatusFilter('all')
                    setProductSort('newest')
                  }}
                  disabled={!productFiltersActive}
                  className="w-full rounded-md border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset filters
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {products.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No products yet. Add your first product above.
                </p>
              ) : filteredProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <p className="font-medium">No matching products</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try a different search or filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch('')
                      setProductCategoryFilter('')
                      setProductStatusFilter('all')
                      setProductSort('newest')
                    }}
                    className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                filteredProducts.map(p => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border bg-secondary">
                        {productThumbnails[String(p.id)] ? (
                          <img
                            src={productThumbnails[String(p.id)]}
                            alt={p.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            No photo
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{p.name}</p>
                          {p.is_featured && (
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
                              Featured
                            </span>
                          )}
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-medium',
                            p.is_available && num(p.stock_quantity) > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          )}>
                            {p.is_available && num(p.stock_quantity) > 0
                              ? `Available · ${num(p.stock_quantity)} PCS`
                              : 'Out of Stock'}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {p.sku || 'No SKU'} · {p.purity || 'Purity not set'} · {p.weight ? `${p.weight} GM` : 'Weight not set'}
                        </p>

                        <p className="mt-1 text-sm font-medium">
                          {num(p.price) > 0
                            ? money(num(p.price))
                            : num(p.rate) > 0 && !num(p.weight)
                              ? money(num(p.rate))
                              : 'Price on request'}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => showStockHistory(p)}
                        className="rounded-md border border-blue-200 px-3 py-1.5 text-sm text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        History
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => addOnePiece(p)}
                        className="rounded-md border border-green-200 px-3 py-1.5 text-sm text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        +1 PC
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy ||
                          num(p.stock_quantity) <= 0
                        }
                        onClick={() => removeOnePiece(p)}
                        className="rounded-md border border-orange-200 px-3 py-1.5 text-sm text-orange-800 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        -1 PC
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy ||
                          num(p.stock_quantity) <= 0
                        }
                        onClick={() => markOneSold(p)}
                        className="rounded-md border border-amber-200 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mark 1 Sold
                      </button>

                      <button
                        type="button"
                        onClick={() => editProduct(p)}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => removeProduct(String(p.id))}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>
      </main>
    </>
  )
}
