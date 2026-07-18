import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthUser } from './authApi'
import { setAccessToken } from '@/shared/api/tokenStore'

interface AuthState {
  user: AuthUser | null
  status: 'idle' | 'authenticated' | 'unauthenticated'
}

const initialState: AuthState = {
  user: null,
  status: 'idle',
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsReceived(state, action: PayloadAction<{ user: AuthUser; accessToken: string }>) {
      state.user = action.payload.user
      state.status = 'authenticated'
      setAccessToken(action.payload.accessToken)
    },
    sessionCleared(state) {
      state.user = null
      state.status = 'unauthenticated'
      setAccessToken(null)
    },
  },
})

export const { credentialsReceived, sessionCleared } = authSlice.actions
export default authSlice.reducer
