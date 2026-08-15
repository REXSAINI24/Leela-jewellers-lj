import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { WhatsAppButton } from '@/components/whatsapp-button'
import type { ShopSettings } from '@/lib/types'

export function HeroSection({ settings }: { settings: ShopSettings }) {
  return (
    <section className="relative overflow-hidden bg-secondary/40">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-12 md:px-6 md:py-20">
        <div className="order-2 flex flex-col items-start gap-5 md:order-1">
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gold-foreground">
            Jodhpur, Rajasthan
          </span>
          <h1 className="text-balance font-serif text-4xl font-semibold leading-tight text-primary md:text-6xl">
            Timeless Jewellery, Crafted to be Treasured
          </h1>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            Discover {settings.shop_name}&apos;s curated collection of gold and
            silver jewellery — rings, necklaces, earrings, bangles and more.
            Browse online and enquire instantly on WhatsApp.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-primary">
              <Link href="/products">Explore Collection</Link>
            </Button>
            <WhatsAppButton
              whatsappNumber={settings.whatsapp_number}
              shopName={settings.shop_name}
              size="lg"
              label="Chat with Us"
            />
          </div>
        </div>

        <div className="order-1 md:order-2">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border border-gold/20 shadow-lg md:max-w-md">
            <Image
              src="/hero-jewellery.png"
              alt="Exquisite gold necklace on cream silk"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
