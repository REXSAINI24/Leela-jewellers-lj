import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Keep the public admin login page reachable, but protect the dashboard.
  if (pathname === '/admin/login') {
    return updateSession(request)
  }

  if (pathname.startsWith('/admin')) {
    const response = await updateSession(request)
    // The shared session helper refreshes cookies; authorization for the
    // dashboard is additionally enforced inside /admin using admin_users RLS.
    return response
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/auth/:path*',
  ],
}
