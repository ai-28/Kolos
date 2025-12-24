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

        // Extract activate_signal BEFORE processing auth (in case it's in the URL)
        // This needs to be done early because Supabase redirect might strip query params
        const urlParams = new URLSearchParams(window.location.search)
        const activateSignalFromUrl = urlParams.get('activate_signal')
        
        // If found in URL, store in sessionStorage immediately (before auth processing)
        if (activateSignalFromUrl && typeof window !== 'undefined') {
          sessionStorage.setItem('kolos_activate_signal', activateSignalFromUrl)
          console.log('📧 Stored activate_signal from URL to sessionStorage')
        }

        // Get tokens from hash fragment
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (!accessToken) {
          // Try to get code parameter (PKCE flow)
          const code = searchParams.get('code')
          if (code) {
            // Exchange code for session
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) {
              console.error('Error exchanging code for session:', error)
              // Check if it's an expired/invalid error
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
          
          // Check for error parameters in URL (from Supabase redirect)
          const errorParam = searchParams.get('error')
          const errorDescription = searchParams.get('error_description')
          if (errorParam) {
            router.push(`/?error=${errorParam}${errorDescription ? '&error_description=' + encodeURIComponent(errorDescription) : ''}`)
            return
          }
          
          router.push('/?error=no_token')
          return
        }

        // Set the session with the access token
        const { data: { user }, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        })

        if (error) {
          console.error('Auth error:', error)
          router.push('/?error=auth_failed')
          return
        }

        if (!user?.email) {
          router.push('/?error=no_email')
          return
        }

        await completeAuth(user.email)
      } catch (error) {
        console.error('Error in auth callback:', error)
        router.push('/?error=callback_error')
      }
    }

    const completeAuth = async (email) => {
      try {
        // Look up user in Users sheet via API
        const response = await fetch(`/api/auth/complete-login?email=${encodeURIComponent(email)}`)
        const data = await response.json()

        if (!response.ok || !data.success) {
          router.push(`/?error=${data.error || 'login_failed'}`)
          return
        }

        // Normalize role and redirect based on role
        const normalizedRole = normalizeRole(data.role || '')
        
        // Check if we need to activate a signal (from email "Activate Kolos" button)
        // Check sessionStorage first (stored early in the auth flow)
        let activateSignal = null
        if (typeof window !== 'undefined') {
          activateSignal = sessionStorage.getItem('kolos_activate_signal')
          console.log('📧 Auth callback checking for activate_signal:', {
            foundInSessionStorage: !!activateSignal,
            value: activateSignal?.substring(0, 50),
          })
        }
        
        // Also check URL params as fallback
        if (!activateSignal) {
          const urlParams = new URLSearchParams(window.location.search)
          activateSignal = urlParams.get('activate_signal')
          console.log('📧 Auth callback checking URL params:', {
            foundInURL: !!activateSignal,
          })
          
          // If found in URL but not in sessionStorage, store it
          if (activateSignal && typeof window !== 'undefined') {
            sessionStorage.setItem('kolos_activate_signal', activateSignal)
            console.log('📧 Stored activate_signal from URL to sessionStorage')
          }
        }
        
        if (normalizedRole === 'Admin') {
          if (activateSignal) {
            // Admin: redirect to admin dashboard with signal data
            router.push(`/admin/dashboard?activate_signal=${encodeURIComponent(activateSignal)}`)
          } else {
            router.push('/admin/dashboard')
          }
        } else {
          if (activateSignal) {
            // Client: redirect to client dashboard with signal data to open deal modal
            // Keep in sessionStorage for dashboard to read
            console.log('📧 Redirecting to client dashboard with activate_signal')
            router.push(`/client/dashboard?activate_signal=${encodeURIComponent(activateSignal)}`)
          } else {
            router.push('/client/dashboard')
          }
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

