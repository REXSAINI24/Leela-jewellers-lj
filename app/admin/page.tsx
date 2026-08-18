'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Category, Product, ShopSettings } from '@/lib/types'
import { slugify } from '@/lib/format'

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
}

const BUCKET = 'product-images'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [ready, setReady] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [product, setProduct] = useState<typeof emptyProduct>(emptyProduct)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [autoSlug, setAutoSlug] = useState(true)
  const [rates, setRates] = useState({ gold_24k: '', gold_22k: '', silver: '' })
  const [ratesBusy, setRatesBusy] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/admin/login'); return }
    const { data: admin } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!admin) { await supabase.auth.signOut(); router.replace('/admin/login'); return }
    const [s, c, p] = await Promise.all([
      supabase.from('shop_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
    ])
    setSettings(s.data as ShopSettings | null)
    setCategories((c.data as Category[]) ?? [])
    setProducts((p.data as Product[]) ?? [])
    setAuthorized(true)
    setReady(true)
  }

  useEffect(() => { load() }, [])

  const canSaveProduct = useMemo(() => product.name.trim().length > 0, [product.name])

  function chooseImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(file ? URL.createObjectURL(file) : '')
  }

  function resetProduct() {
    setProduct(emptyProduct)
    setSlugManuallyEdited(false)
    setAutoSlug(true)
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview('')
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault()
    if (!settings) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('shop_settings').update({
      shop_name: settings.shop_name,
      address: settings.address,
      phone: settings.phone,
      whatsapp_number: settings.whatsapp_number,
      google_maps_url: settings.google_maps_url,
      about: settings.about,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setMessage(error ? error.message : 'Shop details saved.')
    setBusy(false)
    router.refresh()
  }

  useEffect(() => {
    async function loadRates() {
      const { data } = await supabase.from('metal_rates').select('gold_24k, gold_22k, silver').eq('id', 1).maybeSingle()
      if (data) setRates({ gold_24k: data.gold_24k == null ? '' : String(data.gold_24k), gold_22k: data.gold_22k == null ? '' : String(data.gold_22k), silver: data.silver == null ? '' : String(data.silver) })
    }
    loadRates()
  }, [])

  useEffect(() => {
    if (autoSlug && !slugManuallyEdited) {
      setProduct(prev => ({
        ...prev,
        slug: slugify(prev.name),
      }))
    }
  }, [product.name, autoSlug, slugManuallyEdited])

  async function saveRates() {
    setRatesBusy(true); setMessage('')
    const payload = { id: 1, gold_24k: rates.gold_24k === '' ? null : Number(rates.gold_24k), gold_22k: rates.gold_22k === '' ? null : Number(rates.gold_22k), silver: rates.silver === '' ? null : Number(rates.silver), updated_at: new Date().toISOString() }
    const { error } = await supabase.from('metal_rates').upsert(payload, { onConflict: 'id' })
    setMessage(error ? `Could not save metal rates: ${error.message}` : 'Metal rates saved successfully.')
    setRatesBusy(false)
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault()
    if (!canSaveProduct) return
    setBusy(true); setMessage('')

    const payload = {
      name: product.name.trim(),
      slug: (product.slug.trim() || slugify(product.name)).trim(),
      sku: product.sku.trim() || null,
      category_id: product.category_id || null,
      rate: product.rate.trim() || null,
      weight: product.weight.trim() || null,
      price: product.price === '' ? null : Number(product.price),
      purity: product.purity.trim() || null,
      description: product.description.trim() || null,
      is_available: product.is_available,
      is_featured: product.is_featured,
      updated_at: new Date().toISOString(),
    }

    const duplicateQuery = product.id
      ? await supabase.from('products').select('id').eq('slug', payload.slug).neq('id', product.id).maybeSingle()
      : await supabase.from('products').select('id').eq('slug', payload.slug).maybeSingle()

    if (duplicateQuery.error) {
      setMessage(`Could not check slug: ${duplicateQuery.error.message}`)
      setBusy(false)
      return
    }

    if (duplicateQuery.data) {
      setMessage('This slug is already used by another product. Please edit the slug.')
      setBusy(false)
      return
    }

    const result = product.id
      ? await supabase.from('products').update(payload).eq('id', product.id).select('id').single()
      : await supabase.from('products').insert(payload).select('id').single()

    if (result.error || !result.data) {
      setMessage(result.error?.message ?? 'Could not save product.')
      setBusy(false)
      return
    }

    const productId = String(result.data.id)

    if (imageFile) {
      if (!imageFile.type.startsWith('image/')) {
        setMessage('Please choose an image file.')
        setBusy(false)
        return
      }
      if (imageFile.size > 8 * 1024 * 1024) {
        setMessage('Image must be 8 MB or smaller.')
        setBusy(false)
        return
      }

      const safeName = imageFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
      const path = `${productId}/${crypto.randomUUID()}-${safeName || 'image.jpg'}`
      const upload = await supabase.storage.from(BUCKET).upload(path, imageFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: imageFile.type,
      })

      if (upload.error) {
        setMessage(`Product saved, but image upload failed: ${upload.error.message}`)
        await load()
        setBusy(false)
        return
      }

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const imageInsert = await supabase.from('product_images').insert({
        product_id: productId,
        storage_path: path,
        public_url: publicData.publicUrl,
        sort_order: 0,
      })

      if (imageInsert.error) {
        setMessage(`Product saved, but image record failed: ${imageInsert.error.message}`)
        await load()
        setBusy(false)
        return
      }
    }

    setMessage(product.id ? 'Product updated successfully.' : 'Product added successfully.')
    resetProduct()
    await load()
    setBusy(false)
  }

  async function removeProduct(id: string) {
    if (!confirm('Delete this product?')) return
    setBusy(true)
    const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', id)
    if (images?.length) await supabase.storage.from(BUCKET).remove(images.map(x => x.storage_path))
    await supabase.from('product_images').delete().eq('product_id', id)
    const { error } = await supabase.from('products').delete().eq('id', id)
    setMessage(error ? error.message : 'Product deleted.')
    await load(); setBusy(false)
  }


  async function addCategory() {
    const name = newCategory.trim()
    if (!name) return
    setBusy(true); setMessage('')
    const slug = slugify(name)
    const sort_order = categories.length ? Math.max(...categories.map(c => c.sort_order)) + 1 : 1
    const { error } = await supabase.from('categories').insert({ name, slug, sort_order })
    setMessage(error ? error.message : 'Category added successfully.')
    if (!error) setNewCategory('')
    await load(); setBusy(false)
  }

  async function updateCategory(id: string) {
    const name = editingCategoryName.trim()
    if (!name) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('categories').update({ name, slug: slugify(name) }).eq('id', id)
    setMessage(error ? error.message : 'Category updated successfully.')
    if (!error) { setEditingCategoryId(null); setEditingCategoryName('') }
    await load(); setBusy(false)
  }

  async function removeCategory(id: string) {
    if (!confirm('Delete this category? Products already using it may prevent deletion.')) return
    setBusy(true); setMessage('')
    const { error } = await supabase.from('categories').delete().eq('id', id)
    setMessage(error ? `Could not delete category: ${error.message}` : 'Category deleted.')
    await load(); setBusy(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/admin/login')
    router.refresh()
  }

  if (!ready) return <main className="min-h-svh p-8 text-center">Loading owner dashboard…</main>
  if (!authorized) return null

  return (
    <main className="min-h-svh bg-secondary/30 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-5">
          <div><p className="text-xs uppercase tracking-[0.25em] text-gold">LEELA JEWELLERS</p><h1 className="font-serif text-3xl font-semibold text-primary">Owner Dashboard</h1></div>
          <div className="flex gap-2"><button onClick={()=>router.push('/')} className="rounded-md border px-4 py-2 text-sm">View website</button><button onClick={signOut} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Logout</button></div>
        </header>

        {message && <div className="mb-4 rounded-md border bg-background px-4 py-3 text-sm">{message}</div>}

        <section className="mb-6 rounded-2xl border border-border bg-background p-5">
          <h2 className="font-serif text-2xl font-semibold text-primary">Shop Details</h2>
          <form onSubmit={saveSettings} className="mt-4 grid gap-4 md:grid-cols-2">
            {settings && <>
              {([
                ['shop_name','Shop name'],['phone','Mobile number'],['whatsapp_number','WhatsApp number'],['address','Address'],['google_maps_url','Google Maps URL']
              ] as const).map(([key,label]) => (
                <label key={key} className="text-sm font-medium">{label}
                  <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={(settings as any)[key] ?? ''} onChange={e=>setSettings({...settings,[key]:e.target.value})}/>
                </label>
              ))}
              <label className="text-sm font-medium md:col-span-2">About
                <textarea className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2" value={settings.about ?? ''} onChange={e=>setSettings({...settings,about:e.target.value})}/>
              </label>
            </>}
            <button disabled={busy} className="rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground md:w-fit">Save shop details</button>
          </form>
        </section>


        <section className="mb-6 rounded-2xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs uppercase tracking-[0.2em] text-gold">Market Rates</p><h2 className="font-serif text-2xl font-semibold text-primary">Daily Metal Rates</h2></div>
            <p className="text-xs text-muted-foreground">Update whenever your shop's current rates change.</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">Gold 24K (₹/gram)
              <input type="number" min="0" step="0.01" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={rates.gold_24k} onChange={e=>setRates({...rates,gold_24k:e.target.value})} placeholder="e.g. 10000"/>
            </label>
            <label className="text-sm font-medium">Gold 22K (₹/gram)
              <input type="number" min="0" step="0.01" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={rates.gold_22k} onChange={e=>setRates({...rates,gold_22k:e.target.value})} placeholder="e.g. 9200"/>
            </label>
            <label className="text-sm font-medium">Silver (₹/gram)
              <input type="number" min="0" step="0.01" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" value={rates.silver} onChange={e=>setRates({...rates,silver:e.target.value})} placeholder="e.g. 120"/>
            </label>
          </div>
          <button type="button" disabled={ratesBusy} onClick={saveRates} className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{ratesBusy ? 'Saving…' : 'Save metal rates'}</button>
        </section>

        <section className="mb-6 rounded-2xl border border-border bg-background p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs uppercase tracking-[0.2em] text-gold">Catalogue</p><h2 className="font-serif text-2xl font-semibold text-primary">Categories</h2></div>
            <div className="flex w-full gap-2 sm:w-auto">
              <input className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm sm:w-64" placeholder="New category name" value={newCategory} onChange={e=>setNewCategory(e.target.value)} />
              <button type="button" disabled={busy || !newCategory.trim()} onClick={addCategory} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Add</button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(c => <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
              {editingCategoryId === c.id ? <div className="flex min-w-0 flex-1 gap-2"><input className="min-w-0 flex-1 rounded-md border px-2 py-1 text-sm" value={editingCategoryName} onChange={e=>setEditingCategoryName(e.target.value)} /><button type="button" disabled={busy} onClick={()=>updateCategory(c.id)} className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">Save</button></div> : <>
                <span className="truncate text-sm font-medium">{c.name}</span>
                <div className="flex shrink-0 gap-1"><button type="button" disabled={busy} onClick={()=>{setEditingCategoryId(c.id);setEditingCategoryName(c.name)}} className="rounded-md border px-2 py-1 text-xs">Edit</button><button type="button" disabled={busy} onClick={()=>removeCategory(c.id)} className="rounded-md border px-2 py-1 text-xs">Delete</button></div>
              </>}
            </div>)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">You can add more categories anytime. Categories used by existing products may need those products reassigned before deletion.</p>
        </section>

        <section className="mb-6 rounded-2xl border border-border bg-background p-5">
          <h2 className="font-serif text-2xl font-semibold text-primary">{product.id ? 'Edit Product' : 'Add Product'}</h2>
          <form onSubmit={saveProduct} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Product name<input required className="mt-1 w-full rounded-md border px-3 py-2" value={product.name} onChange={e=>{const name=e.target.value;setProduct({...product,name,slug:autoSlug&&!slugManuallyEdited?slugify(name):product.slug})}}/></label>
            <label className="text-sm font-medium">SKU<input className="mt-1 w-full rounded-md border px-3 py-2" value={product.sku} onChange={e=>setProduct({...product,sku:e.target.value})}/></label>
            <label className="text-sm font-medium">Category<select className="mt-1 w-full rounded-md border px-3 py-2" value={product.category_id} onChange={e=>setProduct({...product,category_id:e.target.value})}><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="text-sm font-medium">Price (₹)<input type="number" min="0" className="mt-1 w-full rounded-md border px-3 py-2" value={product.price} onChange={e=>setProduct({...product,price:e.target.value})}/></label>
            <label className="text-sm font-medium">Rate<input className="mt-1 w-full rounded-md border px-3 py-2" value={product.rate} onChange={e=>setProduct({...product,rate:e.target.value})}/></label>
            <label className="text-sm font-medium">Weight<input className="mt-1 w-full rounded-md border px-3 py-2" value={product.weight} onChange={e=>setProduct({...product,weight:e.target.value})}/></label>
            <label className="text-sm font-medium">Purity<input className="mt-1 w-full rounded-md border px-3 py-2" value={product.purity} onChange={e=>setProduct({...product,purity:e.target.value})}/></label>
            <label className="text-sm font-medium">Slug
              <input className="mt-1 w-full rounded-md border px-3 py-2" value={product.slug}
                onChange={e=>{setSlugManuallyEdited(true);setAutoSlug(false);setProduct({...product,slug:e.target.value})}}/>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {autoSlug ? 'Automatic: generated from Product Name.' : 'Manual: you can edit the slug yourself.'}
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded-md border px-3 py-1.5 text-xs"
                  onClick={()=>{setSlugManuallyEdited(false);setAutoSlug(true);setProduct(prev=>({...prev,slug:slugify(prev.name)}))}}>
                  Generate from name
                </button>
                {slugManuallyEdited && (
                  <button type="button" className="rounded-md border px-3 py-1.5 text-xs"
                    onClick={()=>{setSlugManuallyEdited(false);setAutoSlug(true);setProduct(prev=>({...prev,slug:slugify(prev.name)}))}}>
                    Use automatic slug
                  </button>
                )}
              </div>
            </label>
            <label className="text-sm font-medium md:col-span-2">Description<textarea className="mt-1 min-h-24 w-full rounded-md border px-3 py-2" value={product.description} onChange={e=>setProduct({...product,description:e.target.value})}/></label>

            <div className="rounded-xl border border-dashed p-4 md:col-span-2">
              <label className="text-sm font-medium">Product photo</label>
              <input className="mt-2 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={chooseImage}/>
              <p className="mt-1 text-xs text-muted-foreground">Choose one JPG, PNG, WebP or AVIF image up to 8 MB.</p>
              {imagePreview && <img src={imagePreview} alt="Selected product" className="mt-3 h-32 w-32 rounded-lg border object-cover" />}
            </div>

            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={product.is_available} onChange={e=>setProduct({...product,is_available:e.target.checked})}/> Available</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={product.is_featured} onChange={e=>setProduct({...product,is_featured:e.target.checked})}/> Featured</label>
            <div className="flex gap-2 md:col-span-2"><button disabled={busy || !canSaveProduct} className="rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{busy ? 'Saving…' : product.id ? 'Update product' : 'Add product'}</button>{product.id && <button type="button" onClick={resetProduct} className="rounded-md border px-4 py-2.5 text-sm">Cancel</button>}</div>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-background p-5">
          <h2 className="font-serif text-2xl font-semibold text-primary">Products</h2>
          <div className="mt-4 space-y-3">
            {products.length === 0 && <p className="text-sm text-muted-foreground">No products yet.</p>}
            {products.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.sku || 'No SKU'} · {p.price ? `₹${p.price}` : 'Price on request'}</p></div><div className="flex gap-2"><button onClick={()=>{setSlugManuallyEdited(true);setAutoSlug(false);setProduct({...p,id:String(p.id),sku:p.sku??'',category_id:p.category_id??'',rate:p.rate??'',weight:p.weight??'',price:p.price==null?'':String(p.price),purity:p.purity??'',description:p.description??'',is_available:p.is_available,is_featured:p.is_featured})}} className="rounded-md border px-3 py-1.5 text-sm">Edit</button><button onClick={()=>removeProduct(String(p.id))} className="rounded-md border px-3 py-1.5 text-sm">Delete</button></div></div>)}
          </div>
        </section>
      </div>
    </main>
  )
}
