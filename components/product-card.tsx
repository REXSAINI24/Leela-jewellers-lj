import Link from 'next/link'
import Image from 'next/image'
import { Gem } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/format'
import type { ProductWithRelations } from '@/lib/types'

export function ProductCard({
  product,
}: {
  product: ProductWithRelations
}) {
  const image = product.product_images?.[0]

  const price = formatPrice(product.price)

  const weight =
    product.weight && Number(product.weight) > 0
      ? `${product.weight} GM`
      : null

  const purity = product.purity?.trim() || null

  const rate =
    product.rate && Number(product.rate) > 0
      ? formatPrice(product.rate)
      : null

  const category = product.categories?.name || null

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* PRODUCT IMAGE */}
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {image?.public_url ? (
          <Image
            src={image.public_url}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/50">
            <Gem className="size-10" />
          </div>
        )}

        {!product.is_available && (
          <Badge
            variant="secondary"
            className="absolute left-2 top-2 bg-background/90 text-foreground"
          >
            Out of Stock
          </Badge>
        )}
      </div>

      {/* PRODUCT INFORMATION */}
      <div className="flex flex-1 flex-col p-3">
        {/* CATEGORY */}
        {category && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-gold">
            {category}
          </span>
        )}

        {/* PRODUCT NAME */}
        <h3 className="mt-1 line-clamp-2 font-serif text-base font-medium leading-snug text-foreground">
          {product.name}
        </h3>

        {/* PURITY + WEIGHT */}
        {(purity || weight) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {purity && (
              <span className="rounded-md bg-secondary px-2 py-1">
                {purity}
              </span>
            )}

            {weight && (
              <span className="rounded-md bg-secondary px-2 py-1">
                {weight}
              </span>
            )}
          </div>
        )}

        {/* RATE */}
        {rate && (
          <div className="mt-3 text-[11px] text-muted-foreground">
            Rate:{' '}
            <span className="font-medium text-foreground">
              {rate}/GM
            </span>
          </div>
        )}

        {/* PRICE */}
        <div className="mt-auto pt-3">
          {price ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Estimated Price
              </p>

              <span className="text-base font-semibold text-primary">
                {price}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              Enquire for price
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
