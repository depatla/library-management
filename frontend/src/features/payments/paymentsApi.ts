import { baseApi } from '@/shared/api/baseApi'
import type { Page } from '@/features/rooms-cabins/roomsCabinsApi'

export interface Allocation {
  period_month: string
  allocated_amount: number
  is_prorated: boolean
}

export interface Payment {
  id: string
  library_id: string
  student_id: string
  student_name: string
  amount: number
  frequency: string
  period_start: string
  period_end: string
  payment_method: string
  transaction_reference: string | null
  notes: string | null
  collected_by: string
  collected_by_name: string | null
  paid_at: string
  allocations: Allocation[]
}

export interface PaymentCreate {
  student_id: string
  amount: number
  frequency: string
  period_start: string
  period_end?: string | null
  number_of_months?: number | null
  payment_method: string
  transaction_reference?: string | null
  notes?: string | null
}

export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPayments: builder.query<
      Page<Payment>,
      { libraryId: string; page: number; pageSize: number; studentId?: string; search?: string; dateFrom?: string; dateTo?: string }
    >({
      query: ({ libraryId, page, pageSize, studentId, search, dateFrom, dateTo }) => ({
        url: `/libraries/${libraryId}/payments`,
        method: 'GET',
        params: { page, page_size: pageSize, student_id: studentId, search, date_from: dateFrom, date_to: dateTo },
      }),
      providesTags: ['Payment'],
    }),
    getPayment: builder.query<Payment, { libraryId: string; paymentId: string }>({
      query: ({ libraryId, paymentId }) => ({ url: `/libraries/${libraryId}/payments/${paymentId}`, method: 'GET' }),
      providesTags: (_r, _e, { paymentId }) => [{ type: 'Payment', id: paymentId }],
    }),
    createPayment: builder.mutation<Payment[], { libraryId: string; body: PaymentCreate }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/payments`, method: 'POST', data: body }),
      invalidatesTags: ['Payment', 'Dashboard', 'Report'],
    }),
    deletePayment: builder.mutation<void, { libraryId: string; paymentId: string }>({
      query: ({ libraryId, paymentId }) => ({ url: `/libraries/${libraryId}/payments/${paymentId}`, method: 'DELETE' }),
      invalidatesTags: ['Payment', 'Dashboard', 'Report'],
    }),
  }),
})

export const { useListPaymentsQuery, useGetPaymentQuery, useCreatePaymentMutation, useDeletePaymentMutation } = paymentsApi
