import { baseApi } from '@/shared/api/baseApi'
import type { RevenueExpenseMonth } from '@/features/reports/reportsApi'

export interface DashboardSummary {
  new_students_this_month: number
  amount_collected_this_month: number
  expenses_this_month: number
  monthly_series: RevenueExpenseMonth[]
}

export const dashboardSummaryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<DashboardSummary, string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/dashboard/summary`, method: 'GET' }),
      providesTags: ['Dashboard'],
    }),
  }),
})

export const { useGetDashboardSummaryQuery } = dashboardSummaryApi
