import { baseApi } from '@/shared/api/baseApi'
import type { Page } from '@/features/rooms-cabins/roomsCabinsApi'

export interface Partner {
  id: string
  library_id: string
  user_id: string | null
  name: string
  phone: string | null
  share_percentage: number
  is_active: boolean
  email: string | null
}

export interface PartnerCreate {
  name: string
  phone?: string | null
  share_percentage: number
  email?: string | null
  password?: string | null
  user_id?: string | null
}

export interface PartnerUpdate {
  name?: string
  phone?: string | null
  share_percentage?: number
  is_active?: boolean
}

export interface GrantLoginRequest {
  email: string
  password: string
}

export interface Settlement {
  id: string
  partner_id: string
  library_id: string
  period_month: string
  share_amount: number
  received_amount: number
  balance: number
  settled_at: string | null
  notes: string | null
}

export const partnersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPartners: builder.query<Page<Partner>, { libraryId: string; page: number; pageSize: number }>({
      query: ({ libraryId, page, pageSize }) => ({
        url: `/libraries/${libraryId}/partners`,
        method: 'GET',
        params: { page, page_size: pageSize },
      }),
      providesTags: ['Partner'],
    }),
    createPartner: builder.mutation<Partner, { libraryId: string; body: PartnerCreate }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/partners`, method: 'POST', data: body }),
      invalidatesTags: ['Partner'],
    }),
    updatePartner: builder.mutation<Partner, { libraryId: string; partnerId: string; body: PartnerUpdate }>({
      query: ({ libraryId, partnerId, body }) => ({ url: `/libraries/${libraryId}/partners/${partnerId}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Partner'],
    }),
    deletePartner: builder.mutation<void, { libraryId: string; partnerId: string }>({
      query: ({ libraryId, partnerId }) => ({ url: `/libraries/${libraryId}/partners/${partnerId}`, method: 'DELETE' }),
      invalidatesTags: ['Partner'],
    }),
    grantLogin: builder.mutation<Partner, { libraryId: string; partnerId: string; body: GrantLoginRequest }>({
      query: ({ libraryId, partnerId, body }) => ({
        url: `/libraries/${libraryId}/partners/${partnerId}/grant-login`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['Partner'],
    }),
    listSettlements: builder.query<Page<Settlement>, { libraryId: string; partnerId: string; page: number; pageSize: number }>({
      query: ({ libraryId, partnerId, page, pageSize }) => ({
        url: `/libraries/${libraryId}/partners/${partnerId}/settlements`,
        method: 'GET',
        params: { page, page_size: pageSize },
      }),
      providesTags: ['Settlement'],
    }),
    generateSettlements: builder.mutation<Settlement[], { libraryId: string; periodMonth: string }>({
      query: ({ libraryId, periodMonth }) => ({
        url: `/libraries/${libraryId}/partners/settlements/generate`,
        method: 'POST',
        params: { period_month: periodMonth },
      }),
      invalidatesTags: ['Settlement'],
    }),
    recordReceipt: builder.mutation<Settlement, { libraryId: string; settlementId: string; amount: number }>({
      query: ({ libraryId, settlementId, amount }) => ({
        url: `/libraries/${libraryId}/partners/settlements/${settlementId}/record-receipt`,
        method: 'POST',
        data: { amount },
      }),
      invalidatesTags: ['Settlement'],
    }),
  }),
})

export const {
  useListPartnersQuery,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
  useGrantLoginMutation,
  useListSettlementsQuery,
  useGenerateSettlementsMutation,
  useRecordReceiptMutation,
} = partnersApi
