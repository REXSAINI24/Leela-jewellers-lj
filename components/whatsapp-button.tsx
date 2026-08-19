'use client'

import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Product } from '@/lib/types'
import { cn } from '@/lib/utils'

type PricingDetails = {
  gross_weight?: string | number
  stone_weight?: string | number
  net_weight?: string | number
  calculated?: {
    estimated_total?: number
    applicable_rate?: number
    metal_value?: number
    wastage?: number
    making?: number
    stone_total?: number
    other_total?: number
    subtotal?: number
    gst?: number
  }
}

type WhatsAppProduct = Pick<
  Product,
  'name' | 'sku' | 'price' | 'weight' | 'purity'
> & {
  pricing_details?: PricingDetails
  gross_weight?: string | number
  stone_weight?: string | number
  net_weight?: string | number
}

type Props = {
  whatsappNumber: string
  shopName?: string
  product?: WhatsAppProduct
  className?: string
  size?: 'sm' | 'default' | 'lg'
  label?: string
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463.104.104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.335 11.949-11.896 0-3.176-1.24-6.165-3.487-8.411" />
    </svg>
  )
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

function buildProductMessage(
  shopName?: string,
  product?: Props['product'],
  productUrl?: string
) {
  const name = product?.name || 'this product'

  let message =
    `Hello ${shopName || 'LEELA JEWELLERS'}, I am interested in this product:\n\n`

  message += `Product: ${name}\n`

  // Weight details
  const pricing = product?.pricing_details

  const grossWeight =
    pricing?.gross_weight ??
    product?.gross_weight ??
    product?.weight

  const stoneWeight =
    pricing?.stone_weight ??
    product?.stone_weight

  const netWeight =
    pricing?.net_weight ??
    product?.net_weight

  if (grossWeight !== undefined && grossWeight !== '') {
    message += `Gross Weight: ${num(grossWeight).toFixed(3)} GM\n`
  }

  if (stoneWeight !== undefined && stoneWeight !== '') {
    message += `Stone Weight: ${num(stoneWeight).toFixed(3)} GM\n`
  }

  if (netWeight !== undefined && netWeight !== '') {
    message += `Net Metal Weight: ${num(netWeight).toFixed(3)} GM\n`
  }

  if (product?.purity) {
    message += `Purity: ${product.purity}\n`
  }

  if (product?.sku) {
    message += `SKU: ${product.sku}\n`
  }

  // Estimated price
  const estimatedTotal =
    pricing?.calculated?.estimated_total ??
    (product?.price != null
      ? num(product.price)
      : 0)

  if (estimatedTotal > 0) {
    message += `Estimated Price: ${money(estimatedTotal)}\n`
  }

  if (productUrl) {
    message += `\nProduct Link:\n${productUrl}\n`
  }

  message += `\nPlease provide more details about this product.`

  return message
}

function buildWhatsAppLink(
  whatsappNumber: string,
  message: string
) {
  const cleanNumber = String(whatsappNumber || '').replace(/\D/g, '')

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`
}

export function WhatsAppButton({
  whatsappNumber,
  shopName,
  product,
  className,
  size = 'default',
  label = 'Enquire on WhatsApp',
}: Props) {
  const pathname = usePathname()

  function handleClick() {
    const productUrl =
      product && typeof window !== 'undefined'
        ? `${window.location.origin}${pathname}`
        : undefined

    const message = buildProductMessage(
      shopName,
      product,
      productUrl
    )

    const href = buildWhatsAppLink(
      whatsappNumber,
      message
    )

    window.open(
      href,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <Button
      size={size}
      onClick={handleClick}
      className={cn(
        'bg-[#25D366] text-white hover:bg-[#1ebe5b] font-medium',
        className,
      )}
    >
      <WhatsAppIcon className="size-4" />
      {label}
    </Button>
  )
}

export function FloatingWhatsApp({
  whatsappNumber,
  shopName,
}: {
  whatsappNumber: string
  shopName?: string
}) {
  function handleClick() {
    const message =
      `Hello ${shopName || 'LEELA JEWELLERS'}, I would like to know more about your jewellery collection.`

    const href = buildWhatsAppLink(
      whatsappNumber,
      message
    )

    window.open(
      href,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-transform hover:scale-105 active:scale-95"
    >
      <WhatsAppIcon className="size-7" />
    </button>
  )
}
