import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cognipath_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API Error]', err.response?.status, err.response?.data || err.message)
    return Promise.reject(err)
  }
)

export function setAuthToken(token) {
  localStorage.setItem('cognipath_token', token)
}

export function clearAuth() {
  localStorage.removeItem('cognipath_token')
  localStorage.removeItem('cognipath_user')
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('cognipath_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeUser(user) {
  localStorage.setItem('cognipath_user', JSON.stringify(user))
}

/**
 * Auto-create a guest user if no token exists.
 * Returns the user object.
 */
export async function ensureGuestAuth() {
  const existing = getStoredUser()
  const token = localStorage.getItem('cognipath_token')
  if (existing && token) return existing

  const res = await api.post('/auth/guest')
  const { access_token, user } = res.data
  setAuthToken(access_token)
  storeUser(user)
  return user
}
