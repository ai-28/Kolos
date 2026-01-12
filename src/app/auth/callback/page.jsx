"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/app/lib/supabase"
import { Loader2 } from "lucide-react"
import { normalizeRole } from "@/app/lib/roleUtils"

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleAuth = async () => {
      try {
        if (!supabase) {
          router.push('/?error=config_error')
          return
        }

        // Let Supabase process the hash fragment automatically first
        // Wait a bit for Supabase to initialize and process any hash fragments
        await new Promise(resolve => setTimeout(resolve, 300))

        // Check for session multiple times - Supabase processes hash fragments automatically
        // This is especially important for admin.generateLink (implicit flow)
        let session = null
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
          if (currentSession?.user?.email && !sessionError) {
            session = currentSession
            console.log(`✅ Found session on attempt ${attempt + 1}`)
            break
          }
          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
        }

        if (session?.user?.email) {
          console.log('Found existing session, completing auth...')
          await completeAuth(session.user.email)
          return
        }

        // Fallback: Try to manually parse hash fragment (for admin.generateLink implicit flow)
        // This handles cases where Supabase hasn't processed it yet
        let hashParams = null
        let hashString = ''
        
        for (let i = 0; i < 5; i++) {
          hashString = window.location.hash.substring(1)
          if (hashString) {
            try {
              hashParams = new URLSearchParams(hashString)
              break
            } catch (e) {
              console.warn('Error parsing hash params:', e)
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        // Get tokens from hash fragment (implicit flow - used by admin.generateLink)
        const accessToken = hashParams?.get('access_token')
        const refreshToken = hashParams?.get('refresh_token')
        const errorHash = hashParams?.get('error')
        const errorDescriptionHash = hashParams?.get('error_description')

        // Handle errors from hash fragment first
        if (errorHash) {
          console.error('Auth error from hash fragment:', errorHash, errorDescriptionHash)
          router.push(`/?error=${errorHash}${errorDescriptionHash ? '&error_description=' + encodeURIComponent(errorDescriptionHash) : ''}`)
          return
        }

        // If we have tokens in hash fragment (implicit flow from admin.generateLink)
        if (accessToken) {
          console.log('Found access token in hash fragment (implicit flow)')
          const { data: { user }, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })

          if (error) {
            console.error('Auth error setting session:', error)
            router.push('/?error=auth_failed')
            return
          }

          if (!user?.email) {
            router.push('/?error=no_email')
            return
          }

          await completeAuth(user.email)
          return
        }

        // Try to get code parameter (PKCE flow - used by signInWithOtp with flowType: 'pkce')
        // This is the client-side EmailModal flow
        const code = searchParams.get('code')
        if (code) {
          console.log('Found code parameter (PKCE flow)')
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('Error exchanging code for session:', error)
            if (error.message?.includes('expired') || error.message?.includes('invalid')) {
              router.push('/?error=otp_expired&error_description=' + encodeURIComponent(error.message))
              return
            }
            throw error
          }
          if (data?.user?.email) {
            await completeAuth(data.user.email)
            return
          }
        }
        
        // Check for error parameters in URL query (from Supabase redirect)
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')
        if (errorParam) {
          console.error('Auth error from query params:', errorParam, errorDescription)
          router.push(`/?error=${errorParam}${errorDescription ? '&error_description=' + encodeURIComponent(errorDescription) : ''}`)
          return
        }
        
        // No tokens found - log comprehensive debugging info
        console.error('No authentication tokens found.', {
          hash: hashString || window.location.hash,
          hashLength: hashString.length || window.location.hash.length,
          search: window.location.search,
          searchLength: window.location.search.length,
          fullUrl: window.location.href,
          pathname: window.location.pathname,
          hasSession: !!session,
          sessionUser: session?.user?.email || null
        })
        router.push('/?error=no_token')
      } catch (error) {
        console.error('Error in auth callback:', error)
        router.push('/?error=callback_error')
      }
    }

    const completeAuth = async (email) => {
      try {
        console.log('Completing auth for email:', email)
        // Look up user in Users sheet via API
        const response = await fetch(`/api/auth/complete-login?email=${encodeURIComponent(email)}`)
        const data = await response.json()

        if (!response.ok || !data.success) {
          console.error('Complete login failed:', {
            status: response.status,
            error: data.error,
            email: email
          })
          // Show specific error message
          const errorCode = data.error || 'login_failed'
          if (errorCode === 'user_not_found') {
            router.push(`/?error=user_not_found&email=${encodeURIComponent(email)}`)
          } else {
            router.push(`/?error=${errorCode}`)
          }
          return
        }

        console.log('✅ Login successful, redirecting...', {
          email: data.email,
          clientId: data.clientId,
          role: data.role
        })

        // Normalize role and redirect based on role
        const normalizedRole = normalizeRole(data.role || '')
        
        // Wait a moment to ensure all cookies (including Supabase cookies) are properly set
        // This helps middleware detect the session correctly
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Simple redirect - no signal activation logic
        if (normalizedRole === 'Admin') {
          console.log('🔄 Redirecting to admin dashboard')
          router.push('/admin/dashboard')
        } else {
          console.log('🔄 Redirecting to client dashboard')
          router.push('/client/dashboard')
        }
      } catch (error) {
        console.error('Error completing login:', error)
        router.push('/?error=login_failed')
      }
    }

    handleAuth()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0a3d3d] mx-auto mb-4" />
        <p className="text-lg font-marcellus">Completing sign in...</p>
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0a3d3d] mx-auto mb-4" />
          <p className="text-lg font-marcellus">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}

