import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

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

    // Validate Supabase session is still valid
    const isValid = await validateSupabaseSession(cookieStore)
    if (!isValid) {
      // Session expired, clear cookies and redirect
      const url = new URL('/', request.url)
      const response = NextResponse.redirect(url)
      response.cookies.delete('user_email')
      response.cookies.delete('client_id')
      response.cookies.delete('user_role')
      return response
    }
  }

  // Protect admin routes - require admin role
  if (pathname.startsWith('/admin')) {
    if (!clientId) {
      const url = new URL('/', request.url)
      return NextResponse.redirect(url)
    }

    // Validate Supabase session is still valid
    const isValid = await validateSupabaseSession(cookieStore)
    if (!isValid) {
      // Session expired, clear cookies and redirect
      const url = new URL('/', request.url)
      const response = NextResponse.redirect(url)
      response.cookies.delete('user_email')
      response.cookies.delete('client_id')
      response.cookies.delete('user_role')
      return response
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

async function validateSupabaseSession(cookieStore) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return false
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name, options) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    })

    const { data: { user }, error } = await supabase.auth.getUser()

    // Session is valid if we have a user and no error
    return !error && !!user
  } catch (error) {
    console.error('Error validating Supabase session in middleware:', error)
    return false
  }
}

export const config = {
  matcher: ['/client/dashboard/:path*', '/admin/:path*']
}

