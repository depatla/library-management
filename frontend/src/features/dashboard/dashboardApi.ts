import { baseApi } from '@/shared/api/baseApi'

interface HealthDbResponse {
  status: string
  table_count: number
  postgres_version: string
}

export const healthApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDbHealth: builder.query<HealthDbResponse, void>({
      query: () => ({ url: '/health/db', method: 'GET' }),
    }),
  }),
})

export const { useGetDbHealthQuery } = healthApi
