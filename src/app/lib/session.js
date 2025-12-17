import { cookies } from 'next/headers'

export async function getSession() {
  try {
    const cookieStore = await cookies()
    const email = cookieStore.get('user_email')?.value
    const clientId = cookieStore.get('client_id')?.value
    const role = cookieStore.get('user_role')?.value

    if (!email || !clientId) {
      return null
    }

    return { email, clientId, role }
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

