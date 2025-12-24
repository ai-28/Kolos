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

  // Skip validation for auth callback route - let it complete the login flow
  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next()
  }

  // Protect client dashboard routes
  if (pathname.startsWith('/client/dashboard')) {
    if (!clientId) {
      // Redirect to home page if not authenticated
      const url = new URL('/', request.url)
      return NextResponse.redirect(url)
    }

    // SECURITY: Always validate Supabase session - this is the source of truth
    // Supabase session expiration ensures users must re-authenticate with magic link
    const isValid = await validateSupabaseSession(cookieStore)
    if (!isValid) {
      // Check if this is a TRUE fresh login (no Supabase cookies set yet)
      // vs an expired session (Supabase cookies exist but are invalid)
      const hasCustomCookies = cookieStore.get('user_email')?.value
      const allCookies = Array.from(cookieStore.getAll())
      const hasSupabaseCookies = allCookies.some(cookie =>
        cookie.name.startsWith('sb-') ||
        cookie.name.includes('supabase') ||
        (cookie.name.includes('auth') && cookie.name.includes('token'))
      )

      // Only allow through if: custom cookies exist BUT no Supabase cookies yet
      // This means cookies are being set right now (true fresh login)
      // If Supabase cookies exist but are invalid, session expired - require re-login
      if (hasCustomCookies && !hasSupabaseCookies) {
        // True fresh login - Supabase cookies not set yet, allow through this one time
        console.log('⚠️ Fresh login detected - Supabase cookies not set yet, allowing through')
        return NextResponse.next()
      }

      // Supabase session expired or invalid - require re-login
      // This happens when:
      // 1. User was active but Supabase session expired (refresh token expired)
      // 2. User closed browser for hours and came back
      // 3. Supabase cookies exist but are invalid
      console.log('🔒 Security: Supabase session expired or invalid - requiring re-login')
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

    // SECURITY: Always validate Supabase session - this is the source of truth
    const isValid = await validateSupabaseSession(cookieStore)
    if (!isValid) {
      // Same security logic as client dashboard
      const hasCustomCookies = cookieStore.get('user_email')?.value
      const allCookies = Array.from(cookieStore.getAll())
      const hasSupabaseCookies = allCookies.some(cookie =>
        cookie.name.startsWith('sb-') ||
        cookie.name.includes('supabase') ||
        (cookie.name.includes('auth') && cookie.name.includes('token'))
      )

      // Only allow through if: custom cookies exist BUT no Supabase cookies yet
      if (hasCustomCookies && !hasSupabaseCookies) {
        // True fresh login - Supabase cookies not set yet
        console.log('⚠️ Fresh login detected - Supabase cookies not set yet, allowing through')
        return NextResponse.next()
      }

      // Supabase session expired or invalid - require re-login
      console.log('🔒 Security: Supabase session expired or invalid - requiring re-login')
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

    // Check if any Supabase auth cookies exist
    // Supabase uses cookies like: sb-<project-ref>-auth-token
    // Also check for other possible Supabase cookie patterns
    const allCookies = Array.from(cookieStore.getAll())
    const hasSupabaseCookies = allCookies.some(cookie =>
      cookie.name.startsWith('sb-') ||
      cookie.name.includes('supabase') ||
      (cookie.name.includes('auth') && cookie.name.includes('token'))
    )

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          // In middleware, we can't modify cookies in the response
          // This is read-only validation
        },
        remove(name, options) {
          // In middleware, we can't modify cookies in the response
        },
      },
    })

    const { data: { user }, error } = await supabase.auth.getUser()

    // If we have Supabase cookies but getUser fails, session is expired/invalid
    if (error) {
      if (hasSupabaseCookies) {
        // We have cookies but they're invalid - session expired
        console.log('⚠️ Supabase session expired or invalid:', error.message)
        return false
      }
      // No cookies at all - might be fresh login, let middleware handle it
      return false
    }

    // Session is valid if we have a user and no error
    return !!user
  } catch (error) {
    console.error('Error validating Supabase session in middleware:', error)
    return false
  }
}

export const config = {
  matcher: ['/client/dashboard/:path*', '/admin/:path*']
}

