import { baseApi } from '@/shared/api/baseApi'

export interface RevenueExpenseMonth {
  month: string
  revenue: number
  expenses: number
}

export interface RevenueExpenseReport {
  series: RevenueExpenseMonth[]
}

export interface OccupancyCategory {
  room_category_id: string
  room_category_name: string
  total_cabins: number
  occupied_cabins: number
}

export interface OccupancyReport {
  categories: OccupancyCategory[]
  total_lockers: number
  occupied_lockers: number
}

export interface StudentsSummaryMonth {
  month: string
  new_count: number
  active_count: number
  expired_count: number
}

export interface StudentsSummaryReport {
  series: StudentsSummaryMonth[]
}

export interface ContributionMonth {
  month: string
  user_id: string
  full_name: string
  collected_amount: number
  spent_amount: number
}

export interface ContributionsReport {
  series: ContributionMonth[]
}

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRevenueExpenseReport: builder.query<RevenueExpenseReport, { libraryId: string; months?: number }>({
      query: ({ libraryId, months = 6 }) => ({ url: `/libraries/${libraryId}/reports/revenue-expense`, method: 'GET', params: { months } }),
      providesTags: ['Report'],
    }),
    getOccupancyReport: builder.query<OccupancyReport, string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/reports/occupancy`, method: 'GET' }),
      providesTags: ['Report'],
    }),
    getStudentsSummaryReport: builder.query<StudentsSummaryReport, { libraryId: string; months?: number }>({
      query: ({ libraryId, months = 6 }) => ({ url: `/libraries/${libraryId}/reports/students-summary`, method: 'GET', params: { months } }),
      providesTags: ['Report'],
    }),
    getContributionsReport: builder.query<ContributionsReport, { libraryId: string; months?: number }>({
      query: ({ libraryId, months = 6 }) => ({ url: `/libraries/${libraryId}/reports/contributions`, method: 'GET', params: { months } }),
      providesTags: ['Report'],
    }),
  }),
})

export const {
  useGetRevenueExpenseReportQuery,
  useGetOccupancyReportQuery,
  useGetStudentsSummaryReportQuery,
  useGetContributionsReportQuery,
} = reportsApi
