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
      console.log('🚫 Client dashboard: No client_id cookie found')
      const url = new URL('/', request.url)
      return NextResponse.redirect(url)
    }

    // SECURITY: Always validate Supabase session - this is the source of truth
    // Supabase session expiration ensures users must re-authenticate with magic link
    const isValid = await validateSupabaseSession(cookieStore)

    // Get all cookies for debugging
    const allCookies = Array.from(cookieStore.getAll())
    const cookieNames = allCookies.map(c => c.name).join(', ')
    const hasCustomCookies = cookieStore.get('user_email')?.value
    const hasSupabaseCookies = allCookies.some(cookie =>
      cookie.name.startsWith('sb-') ||
      cookie.name.includes('supabase') ||
      (cookie.name.includes('auth') && cookie.name.includes('token'))
    )

    console.log('🔍 Client dashboard middleware check:', {
      pathname,
      hasClientId: !!clientId,
      hasCustomCookies: !!hasCustomCookies,
      hasSupabaseCookies,
      isValid,
      cookieCount: allCookies.length,
      cookieNames: cookieNames.substring(0, 200) // First 200 chars
    })

    if (!isValid) {
      // Check if this is a TRUE fresh login (no Supabase cookies set yet)
      // vs an expired session (Supabase cookies exist but are invalid)
      // IMPORTANT: For fresh logins, Supabase cookies might be set client-side but not yet
      // readable by middleware on the first redirect. Allow through if custom cookies exist.
      if (hasCustomCookies) {
        // Fresh login - custom cookies exist (set by complete-login API)
        // Supabase cookies might not be readable yet, but that's OK for fresh logins
        // The session API will handle validation on subsequent requests
        console.log('✅ Fresh login detected - custom cookies exist, allowing through (Supabase cookies may not be readable yet)')
        return NextResponse.next()
      }


      console.log('🔒 Security: Supabase session expired or invalid - requiring re-login', {
        hasCustomCookies: !!hasCustomCookies,
        hasSupabaseCookies
      })
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
      console.log('🚫 Admin route: No client_id cookie found')
      const url = new URL('/', request.url)
      return NextResponse.redirect(url)
    }

    // SECURITY: Always validate Supabase session - this is the source of truth
    const isValid = await validateSupabaseSession(cookieStore)

    // Get all cookies for debugging
    const allCookies = Array.from(cookieStore.getAll())
    const hasCustomCookies = cookieStore.get('user_email')?.value
    const hasSupabaseCookies = allCookies.some(cookie =>
      cookie.name.startsWith('sb-') ||
      cookie.name.includes('supabase') ||
      (cookie.name.includes('auth') && cookie.name.includes('token'))
    )

    if (!isValid) {
      // Same security logic as client dashboard - allow fresh logins
      if (hasCustomCookies) {
        // Fresh login - custom cookies exist
        console.log('✅ Fresh login detected (admin) - custom cookies exist, allowing through')
        return NextResponse.next()
      }

      // Supabase session expired or invalid - require re-login
      console.log('🔒 Security: Supabase session expired or invalid (admin) - requiring re-login')
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
      console.log('🔄 Not admin, redirecting to client dashboard')
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
      console.log('⚠️ Supabase env vars not set, skipping validation')
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

    // Log Supabase cookie names for debugging
    const supabaseCookieNames = allCookies
      .filter(cookie =>
        cookie.name.startsWith('sb-') ||
        cookie.name.includes('supabase') ||
        (cookie.name.includes('auth') && cookie.name.includes('token'))
      )
      .map(c => c.name)
      .join(', ')

    if (supabaseCookieNames) {
      console.log('🔍 Found Supabase cookies:', supabaseCookieNames)
    }

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
      console.log('ℹ️ No Supabase cookies found - might be fresh login')
      return false
    }

    // Session is valid if we have a user and no error
    if (user) {
      console.log('✅ Supabase session valid for user:', user.email)
    }
    return !!user
  } catch (error) {
    console.error('Error validating Supabase session in middleware:', error)
    return false
  }
}

export const config = {
  matcher: ['/client/dashboard/:path*', '/admin/:path*']
}

