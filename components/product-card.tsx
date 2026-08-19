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
  const image = product.product_images[0]

  /*
   * ============================================================
   * PIECE / DIRECT PRICE
   * ============================================================
   *
   * Piece products do not depend on today's metal rate.
   *
   * If product.price exists, use it.
   * Otherwise, if the product has no weight and has a rate,
   * treat product.rate as its direct piece price.
   */

  const productWeight = Number(product.weight ?? 0)

  const directPieceRate =
    productWeight <= 0 &&
    product.rate &&
    Number(product.rate) > 0
      ? Number(product.rate)
      : null

  const finalPrice =
    directPieceRate !== null
      ? directPieceRate
      : product.price

  const price = formatPrice(finalPrice)

  const weight = product.weight
    ? `${product.weight} GM`
    : null

  const purity = product.purity || null

  /*
   * RATE DISPLAY
   *
   * For piece products, rate is already their direct price,
   * so we don't show "Rate/GM".
   */
  const rate =
    productWeight > 0 && product.rate
      ? formatPrice(product.rate)
      : null

  const stockQuantity =
    Number(product.stock_quantity ?? 0)

  const isInStock =
    product.is_available &&
    stockQuantity > 0

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* ======================================================
          PRODUCT IMAGE
      ====================================================== */}

      <div className="relative aspect-square overflow-hidden bg-secondary">
        {image ? (
          <Image
            src={
              image.public_url ||
              '/placeholder.svg'
            }
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

        {/* STOCK STATUS */}

        {!isInStock && (
          <Badge
            variant="secondary"
            className="absolute left-2 top-2 bg-background/90 text-foreground"
          >
            Out of Stock
          </Badge>
        )}
      </div>

      {/* ======================================================
          PRODUCT INFO
      ====================================================== */}

      <div className="flex flex-1 flex-col p-3">

        {/* CATEGORY */}

        {product.categories && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-gold">
            {product.categories.name}
          </span>
        )}

        {/* NAME */}

        <h3 className="mt-1 line-clamp-2 font-serif text-base font-medium leading-snug text-foreground">
          {product.name}
        </h3>

        {/* WEIGHT + PURITY */}

        {(weight || purity) && (
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

        {/* METAL RATE */}

        {rate && (
          <div className="mt-3 text-[11px] text-muted-foreground">
            Rate:{' '}
            <span className="font-medium text-foreground">
              {rate}/GM
            </span>
          </div>
        )}

        {/* STOCK QUANTITY */}

        <div className="mt-2">
          {isInStock ? (
            <span className="text-[11px] font-medium text-green-600">
              Available · {stockQuantity} PCS
            </span>
          ) : (
            <span className="text-[11px] font-medium text-red-600">
              Out of Stock
            </span>
          )}
        </div>

        {/* ==================================================
            PRICE
        ================================================== */}

        <div className="mt-auto pt-3">
          {price ? (
            <div>

              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {directPieceRate !== null
                  ? 'Price / Piece'
                  : 'Estimated Price'}
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
