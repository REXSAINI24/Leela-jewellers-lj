'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Category, Product, ShopSettings } from '@/lib/types'
import { slugify } from '@/lib/format'

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

type PricingDetails = {
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

const emptyPricing: PricingDetails = {
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
return ${Date.now()}-${Math.random().toString(36).slice(2)}
}

function num(value: string | number | null | undefined) {
const n = Number(value)
return Number.isFinite(n) ? n : 0
}

function money(value: number) {
return ₹${Math.max(0, value).toLocaleString('en-IN', {
minimumFractionDigits: 2,
maximumFractionDigits: 2,
})}`
}

export default function AdminPage() {
const router = useRouter()
const supabase = createClient()

const [ready, setReady] = useState(false)
const [authorized, setAuthorized] = useState(false)
const [settings, setSettings] = useState(null)
const [categories, setCategories] = useState([])
const [products, setProducts] = useState([])
const [product, setProduct] = useState(emptyProduct)
const [pricing, setPricing] = useState(emptyPricing)
const [chargeTypes, setChargeTypes] = useState([])
const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
const [autoSlug, setAutoSlug] = useState(true)
const [rates, setRates] = useState({
gold_24k: '',
gold_22k: '',
silver: '',
})
const [ratesBusy, setRatesBusy] = useState(false)

// MULTIPLE IMAGE SYSTEM
const [imageFiles, setImageFiles] = useState([])
const [imagePreviews, setImagePreviews] = useState([])

const [message, setMessage] = useState('')
const [busy, setBusy] = useState(false)
const [newCategory, setNewCategory] = useState('')
const [editingCategoryId, setEditingCategoryId] = useState(null)
const [editingCategoryName, setEditingCategoryName] = useState('')
const [newChargeType, setNewChargeType] = useState('')
const [popup, setPopup] = useState(null)

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
error.details ? Details:${error.details}: '', error.hint ?Hint: {error.code}` : '',
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
e: ChangeEvent
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
"${file.name}" is not a valid image file.`
)
continue
}

if (file.size > 8 * 1024 * 1024) {
showPopup(
'error',
'Image Too Large',
"${file.name}" is larger than 8 MB.`
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

function resetProduct() {
setProduct(emptyProduct)
setPricing(emptyPricing)
setSlugManuallyEdited(false)
setAutoSlug(true)
setImageFiles([])

imagePreviews.forEach(preview =>
URL.revokeObjectURL(preview)
)

setImagePreviews([])
}

function updatePricing(
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
"${name}" is now available in Other Charges.`
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

price: null,

purity:
product.purity.trim() || null,

description:
product.description.trim() || null,

is_available:
product.is_available,

is_featured:
product.is_featured,

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
/^-+|-+`$/g,
''
)

const path =
${productId}/${crypto.randomUUID()}-${safeName || image-${index + 1}.jpg}

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

Product information was saved.\n\n${uploadedCount} image(s) uploaded successfully.\n\nImage ${index + 1} could not be uploaded.\n\n${errorText(upload.error)}`
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

Product was saved and${uploadedCount} image(s) were uploaded.\n\nImage latex
{index + 1} record could not be created.\n\n

{errorText(imageInsert.error)}`
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
? Product, pricing details and ${imageFiles.length} new image(s) were updated successfully.`
: 'The product, pricing details and other saved information were updated successfully.'

: imageFiles.length > 0
? The new product and its pricing details were added successfully with${imageFiles.length} image(s).`
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
p.price == null
? ''
: String(p.price),

purity:
p.purity ?? '',

description:
p.description ?? '',

is_available:
p.is_available,

is_featured:
p.is_featured,
})

if (raw) {
setPricing({
...emptyPricing,
...raw,

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
"${name}" was added successfully.`
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

Loading owner dashboard…

)
}

if (!authorized) return null

return (
<>
{popup && (


className={flex size-14 items-center justify-center rounded-full text-2xl${
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



{popup.title}



{popup.message}



type="button"
onClick={() =>
setPopup(null)
}
className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
>
OK



)}







LEELA JEWELLERS




Owner Dashboard




onClick={() =>
router.push('/')
}
className="rounded-md border px-4 py-2 text-sm"
>
View website


onClick={signOut}
className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
>
Logout




{message && (

{message}

)}

{/* SHOP DETAILS */}



Shop Details


onSubmit={saveSettings}
className="mt-4 grid gap-4 md:grid-cols-2"
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
key={key}
className="text-sm font-medium"
>
{label}

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

)
)}


About

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


)}

disabled={busy}
className="rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground md:w-fit"
>
Save shop details




{/* METAL RATES */}





Market Rates




Daily Metal Rates




Update whenever your shop's current rates change.






Gold 24K (₹/gram)

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



Gold 22K (₹/gram)

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



Silver (₹/gram)

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



type="button"
disabled={ratesBusy}
onClick={saveRates}
className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
>
{ratesBusy
? 'Saving…'
: 'Save metal rates'}



{/* CATEGORIES */}





Catalogue




Categories




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





{categories.map(c => (
key={c.id}
className="flex items-center justify-between gap-2 rounded-lg border p-3"
>
{editingCategoryId ===
c.id ? (

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


) : (
<>

{c.name}



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



)}

))}



You can add more categories anytime.




{/* ADD / EDIT PRODUCT */}



{product.id
? 'Edit Product'
: 'Add Product'}


onSubmit={saveProduct}
className="mt-4 space-y-6"
>

{/* BASIC PRODUCT DETAILS */}




Product name

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



SKU

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



Category

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
Select category

{categories.map(
c => (
key={c.id}
value={c.id}
>
{c.name}

)
)}




Purity

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



Slug

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


{autoSlug
? 'Automatic: generated from Product Name.'
: 'Manual: you can edit the slug yourself.'}



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


{slugManuallyEdited && (
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

)}




{/* WEIGHT DETAILS */}





Weight Details




Metal & Stone Weight




Net metal weight = Gross − Stone






Gross Weight (GM)

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



Total Stone Weight (GM)

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

Calculated from Stone rows.

)}




Net Metal Weight




{netWeight.toFixed(
3
)}{' '}
GM






{/* MAKING & WASTAGE */}



Making & Wastage




Pricing Rules




{/* MAKING */}



Making Charges





Value

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



Type

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
₹ / Gram

% of Metal Value

Fixed Amount



{pricing.making_type ===
'per_gram' && (

Weight Basis

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
Net Weight

Gross Weight


)}



Calculated Making:{' '}
{money(making)}




{/* WASTAGE */}



Wastage / VA





Value

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



Type

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
Percent

Fixed Amount



{pricing.wastage_type ===
'percent' && (

Calculation Basis

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
Metal Value

Net Weight

Gross Weight


)}



Calculated Wastage:{' '}
{money(wastage)}






{/* STONES */}





Stone Charges




Add Stones



type="button"
onClick={addStone}
className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
>
+ Add Stone



{pricing.stones.length ===
0 ? (

No stones added. You can add multiple stone rows.


) : (

{pricing.stones.map(
(row, index) => (
key={row.id}
className="rounded-lg border p-4"
>


Stone {index + 1}



type="button"
onClick={() =>
removeStone(
row.id
)
}
className="rounded-md border px-2 py-1 text-xs"
>
Remove





Stone Name

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



Size

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



Quality

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



Pcs

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



Price / Pc (₹)

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



Stone Weight (GM)

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




Stone Total:{' '}
{money(
num(row.pcs) *
num(
row.price_per_pc
)
)}



)
)}



Total Stone Weight:{' '}
{calculatedStoneWeight.toFixed(
3
)}{' '}
GM



Total Stone Charges:{' '}
{money(
stoneTotal
)}



)}


{/* OTHER CHARGES */}





Other Charges




Add Other Charges



type="button"
onClick={
addOtherCharge
}
className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
>
+ Add Other




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



{pricing.other_charges
.length === 0 ? (

No other charges added.


) : (

{pricing.other_charges.map(
(row, index) => (
key={row.id}
className="rounded-lg border p-4"
>


Other Charge{' '}
{index + 1}



type="button"
onClick={() =>
removeOther(
row.id
)
}
className="rounded-md border px-2 py-1 text-xs"
>
Remove





Charge For

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
key={
type
}
value={
type
}
>
{type}

)
)}

{!chargeTypes.includes(
row.charge_type
) && (
value={
row.charge_type
}
>
{
row.charge_type
}

)}




Description

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



Qty

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



Price / Unit (₹)

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




Charge Total:{' '}
{money(
num(
row.quantity
) *
num(
row.price_per_unit
)
)}



)
)}


Total Other Charges:{' '}
{money(otherTotal)}


)}


{/* FINAL CALCULATION */}





Final Calculation




Estimated Price




GST (%)

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






Net Metal Weight



{netWeight.toFixed(
3
)}{' '}
GM





Applicable Metal Rate



{money(
applicableRate
)}{' '}
/ GM





Metal Value



{money(
metalValue
)}





Wastage / VA



{money(wastage)}





Making Charges



{money(making)}





Stone Charges



{money(
stoneTotal
)}





Other Charges



{money(
otherTotal
)}







Subtotal



{money(subtotal)}





GST (
{num(
pricing.gst_percent
)}
%)



{money(gst)}







Estimated Total



{money(
estimatedTotal
)}





{/* DESCRIPTION */}


Description

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


{/* ========================================
MULTIPLE PRODUCT PHOTOS
======================================== */}






Product Photos




You can select multiple photos for the same product.




{imageFiles.length >
0 && (

{imageFiles.length}{' '}
photo
{imageFiles.length >
1
? 's'
: ''}{' '}
selected

)}


className="mt-3 block w-full text-sm"
type="file"
accept="image/jpeg,image/png,image/webp,image/avif"
multiple
onChange={
chooseImages
}
/>


Select multiple JPG, PNG, WebP or AVIF images. Maximum 8 MB per image.



{/* IMAGE PREVIEWS */}

{imagePreviews.length >
0 && (


{imagePreviews.map(
(
preview,
index
) => (
key={
preview
}
className="relative overflow-hidden rounded-xl border bg-secondary"
>
src={
preview
}
alt={Selected product ${index + 1}`}
className="aspect-square w-full object-cover"
/>


{index + 1}


type="button"
onClick={() =>
removeSelectedImage(
index
)
}
className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white hover:bg-black"
>
✕


)
)}


)}



{/* AVAILABLE / FEATURED */}



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



{/* SAVE BUTTONS */}


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


{product.id && (
type="button"
onClick={
resetProduct
}
className="rounded-md border px-4 py-2.5 text-sm"
>
Cancel

)}





{/* PRODUCTS LIST */}



Products



{products.length ===
0 && (

No products yet.


)}

{products.map(p => (
key={p.id}
className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
>


{p.name}




{p.sku ||
'No SKU'}{' '}
·{' '}
{p.price
? ₹${p.price}`
: 'Price on request'}





onClick={() =>
editProduct(p)
}
className="rounded-md border px-3 py-1.5 text-sm"
>
Edit


onClick={() =>
removeProduct(
String(
p.id
)
)
}
className="rounded-md border px-3 py-1.5 text-sm"
>
Delete



))}






)
}
