import Link from 'next/link'
import Image from 'next/image'
import { Gem } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/format'
import type { ProductWithRelations } from '@/lib/types'

export function ProductCard({ product }: { product: ProductWithRelations }) {
  const image = product.product_images[0]
  const price = formatPrice(product.price)

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {image ? (
          <Image
            src={image.public_url || '/placeholder.svg'}
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
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.categories && (
          <span className="text-[10px] uppercase tracking-widest text-gold">
            {product.categories.name}
          </span>
        )}
        <h3 className="line-clamp-2 font-serif text-base font-medium leading-snug text-foreground">
          {product.name}
        </h3>
        <div className="mt-auto pt-1">
          {price ? (
            <span className="text-sm font-semibold text-primary">{price}</span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Enquire for price
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
