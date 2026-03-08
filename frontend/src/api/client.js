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
  async (err) => {
    console.error('[API Error]', err.response?.status, err.response?.data || err.message)
    // Auto-clear stale auth on 401 and retry guest auth once
    if (err.response?.status === 401 && !err.config._retried) {
      clearAuth()
      try {
        const res = await api.post('/auth/guest')
        const { access_token, user } = res.data
        setAuthToken(access_token)
        storeUser(user)
        err.config._retried = true
        err.config.headers.Authorization = `Bearer ${access_token}`
        return api(err.config)
      } catch { /* fall through */ }
    }
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
 * Auto-create a guest user if no token exists or existing token is invalid.
 * Returns the user object.
 */
export async function ensureGuestAuth() {
  const existing = getStoredUser()
  const token = localStorage.getItem('cognipath_token')
  if (existing && token) {
    // Validate the token is still good
    try {
      const res = await api.get('/auth/me')
      const user = res.data.user || res.data
      storeUser(user)
      return user
    } catch {
      // Token is stale — clear and fall through to create guest
      clearAuth()
    }
  }

  const res = await api.post('/auth/guest')
  const { access_token, user } = res.data
  setAuthToken(access_token)
  storeUser(user)
  return user
}
