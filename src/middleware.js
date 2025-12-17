import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Helper function to normalize role (inline version for middleware)
function normalizeRole(roleString) {
  if (!roleString || typeof roleString !== 'string') return "Investor"
  
  const roleLower = roleString.toLowerCase().trim()
  
  if (roleLower.includes('admin') || roleLower.includes('administrator')) {
    return "Admin"
  }
  if (roleLower.includes('facilitator')) {
    return "Facilitator"
  }
  if (roleLower.includes('entrepreneur') || 
      roleLower.includes('founder') || 
      roleLower.includes('cofounder') ||
      roleLower.includes('co-founder')) {
    return "Entrepreneur"
  }
  if (roleLower.includes('asset manager') || 
      roleLower.includes('managing partner') ||
      roleLower.includes('assetmanager')) {
    return "Asset Manager"
  }
  if (roleLower.includes('investor')) {
    return "Investor"
  }
  return "Investor"
}

export async function middleware(request) {
  const cookieStore = await cookies()
  const clientId = cookieStore.get('client_id')?.value
  const role = cookieStore.get('user_role')?.value || ''
  const pathname = request.nextUrl.pathname

  // Protect client dashboard routes
  if (pathname.startsWith('/client/dashboard')) {
    if (!clientId) {
      // Redirect to home page if not authenticated
      const url = new URL('/', request.url)
      return NextResponse.redirect(url)
    }
  }

  // Protect admin routes - require admin role
  if (pathname.startsWith('/admin')) {
    if (!clientId) {
      const url = new URL('/', request.url)
      return NextResponse.redirect(url)
    }
    const normalizedRole = normalizeRole(role)
    if (normalizedRole !== 'Admin') {
      // Not an admin, redirect to client dashboard
      const url = new URL('/client/dashboard', request.url)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/client/dashboard/:path*', '/admin/:path*']
}

