'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError || !data.user) {
      setError('Login failed. Please check your email and password.')
      setLoading(false)
      return
    }
    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id, role')
      .eq('user_id', data.user.id)
      .maybeSingle()
    if (adminError || !admin) {
      await supabase.auth.signOut()
      setError('This account is not authorized as the shop owner.')
      setLoading(false)
      return
    }
    router.replace('/admin')
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-background px-4 py-10">
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">LEELA JEWELLERS</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-primary">Owner Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">Private shop management</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <button disabled={loading} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
