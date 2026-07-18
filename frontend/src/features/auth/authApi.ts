import { baseApi } from '@/shared/api/baseApi'

export interface Membership {
  library_id: string
  library_name: string
  library_status: string
  role: string
}

export interface AuthUser {
  id: string
  full_name: string
  email: string
  is_super_admin: boolean
  memberships: Membership[]
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export interface LoginRequest {
  email: string
  password: string
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', data: body }),
    }),
    logout: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    me: builder.query<AuthUser, void>({
      query: () => ({ url: '/auth/me', method: 'GET' }),
    }),
  }),
})

export const { useLoginMutation, useLogoutMutation, useMeQuery } = authApi
