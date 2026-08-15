import Link from 'next/link'
import { MapPin, Phone } from 'lucide-react'
import type { Category, ShopSettings } from '@/lib/types'

export function SiteFooter({
  settings,
  categories,
}: {
  settings: ShopSettings
  categories: Category[]
}) {
  return (
    <footer className="border-t border-border/70 bg-secondary/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3 md:px-6">
        <div>
          <h3 className="font-serif text-2xl font-semibold text-primary">
            {settings.shop_name}
          </h3>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Timeless gold and silver jewellery, crafted with care and offered
            with a personal touch in the heart of Jodhpur.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground">
            Collection
          </h4>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
            {categories.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/products?category=${c.slug}`}
                  className="hover:text-primary"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-foreground">
            Visit Us
          </h4>
          <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground">
            <p className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
              <span>{settings.address}</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-gold" />
              <span>{settings.phone}</span>
            </p>
          </div>
        </div>
      </div>
      <div className="border-t border-border/70 py-4">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {settings.shop_name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
