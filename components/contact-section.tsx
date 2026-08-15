import { MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { mapsUrl, telUrl } from '@/lib/format'
import type { ShopSettings } from '@/lib/types'

export function ContactSection({ settings }: { settings: ShopSettings }) {
  return (
    <section id="contact" className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gold">
            Visit our store
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold md:text-4xl">
            {settings.shop_name}
          </h2>
          <p className="mt-4 flex max-w-sm gap-2 leading-relaxed text-primary-foreground/80">
            <MapPin className="mt-1 size-5 shrink-0 text-gold" />
            <span>{settings.address}</span>
          </p>
          <p className="mt-3 flex items-center gap-2 text-primary-foreground/80">
            <Phone className="size-5 shrink-0 text-gold" />
            <span>{settings.phone}</span>
          </p>
          {settings.about && (
            <p className="mt-4 max-w-md leading-relaxed text-primary-foreground/70">
              {settings.about}
            </p>
          )}
        </div>

        <div className="flex flex-col justify-center gap-3">
          <WhatsAppButton
            whatsappNumber={settings.whatsapp_number}
            shopName={settings.shop_name}
            size="lg"
            label="Message on WhatsApp"
          />
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="w-full"
          >
            <a href={telUrl(settings.phone)}>
              <Phone className="size-4" />
              Call the Store
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <a
              href={mapsUrl(settings)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin className="size-4" />
              Get Directions
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
