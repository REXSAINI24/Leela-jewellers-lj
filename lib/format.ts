import type { Product, ShopSettings } from './types'

export function formatPrice(price: number | null | undefined): string | null {
  if (price === null || price === undefined) return null
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price)
}

/** Normalise a phone number to digits only, for use in wa.me / tel: links. */
export function normalizePhone(raw: string): string {
  return (raw || '').replace(/[^\d]/g, '')
}

/** Build a WhatsApp click-to-chat URL with a pre-filled enquiry message. */
export function buildWhatsAppUrl(
  whatsappNumber: string,
  product?: Pick<Product, 'name' | 'sku' | 'price' | 'weight' | 'purity'>,
  shopName = 'LEELA JEWELLERS',
): string {
  const number = normalizePhone(whatsappNumber)
  let message: string

  if (product) {
    const lines = [
      `Hello ${shopName}, I am interested in this product:`,
      '',
      `Product: ${product.name}`,
    ]
    if (product.sku) lines.push(`Product ID: ${product.sku}`)
    const price = formatPrice(product.price)
    if (price) lines.push(`Price: ${price}`)
    if (product.weight) lines.push(`Weight: ${product.weight}`)
    if (product.purity) lines.push(`Purity: ${product.purity}`)
    lines.push('', 'Please provide more details.')
    message = lines.join('\n')
  } else {
    message = `Hello ${shopName}, I would like to know more about your jewellery collection.`
  }

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function telUrl(phone: string): string {
  return `tel:+${normalizePhone(phone)}`
}

export function mapsUrl(settings: Pick<ShopSettings, 'google_maps_url' | 'address'>): string {
  if (settings.google_maps_url && settings.google_maps_url.trim().length > 0) {
    return settings.google_maps_url
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`
}

/** Create a URL-friendly slug from a product name. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
