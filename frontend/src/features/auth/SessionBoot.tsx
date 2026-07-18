import { useEffect, useState, type ReactNode } from 'react'
import axios from 'axios'
import { CircularProgress, Box } from '@mui/material'
import { useAppDispatch } from '@/app/hooks'
import { credentialsReceived, sessionCleared } from './authSlice'
import { authApi } from './authApi'
import { store } from '@/app/store'
import { setAccessToken } from '@/shared/api/tokenStore'

/**
 * Runs once on app mount. The access token lives only in memory, so a full
 * page reload loses it — this silently exchanges the httpOnly refresh_token
 * cookie for a new access token and re-hydrates the current user before
 * rendering any routes, so ProtectedRoute doesn't briefly bounce to /login.
 */
export function SessionBoot({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function bootstrap() {
      try {
        const { data } = await axios.post<{ access_token: string }>(
          '/api/v1/auth/refresh',
          {},
          { withCredentials: true },
        )
        setAccessToken(data.access_token)
        const meResult = await store.dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true }))
        if ('data' in meResult && meResult.data) {
          dispatch(credentialsReceived({ user: meResult.data, accessToken: data.access_token }))
        } else {
          dispatch(sessionCleared())
        }
      } catch {
        dispatch(sessionCleared())
      } finally {
        setReady(true)
      }
    }
    bootstrap()
  }, [dispatch])

  if (!ready) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  return <>{children}</>
}
