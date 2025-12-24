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

        // Wait a moment for hash fragment to be available (important for admin.generateLink magic links)
        // The hash fragment might not be immediately available when page loads from redirect
        await new Promise(resolve => setTimeout(resolve, 100))

        // Get tokens from hash fragment (implicit flow - used by admin.generateLink)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const errorHash = hashParams.get('error')
        const errorDescriptionHash = hashParams.get('error_description')

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
        
        // No tokens found - log for debugging
        console.error('No authentication tokens found. Hash:', window.location.hash.substring(0, 50), 'Query:', window.location.search)
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
        
        // Simple redirect - no signal activation logic
        if (normalizedRole === 'Admin') {
          router.push('/admin/dashboard')
        } else {
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

