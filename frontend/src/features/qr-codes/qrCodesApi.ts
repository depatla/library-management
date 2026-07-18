import { baseApi } from '@/shared/api/baseApi'

export interface QrCode {
  id: string
  library_id: string
  type: string
  target_path: string
  image_url: string | null
  is_active: boolean
}

export const qrCodesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listQrCodes: builder.query<QrCode[], string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/qr-codes`, method: 'GET' }),
      providesTags: ['QrCode'],
    }),
    generateQrCode: builder.mutation<QrCode, { libraryId: string; type: 'seat_availability' | 'complaint' }>({
      query: ({ libraryId, type }) => ({ url: `/libraries/${libraryId}/qr-codes/generate`, method: 'POST', data: { type } }),
      invalidatesTags: ['QrCode'],
    }),
    setQrCodeActive: builder.mutation<QrCode, { libraryId: string; qrCodeId: string; isActive: boolean }>({
      query: ({ libraryId, qrCodeId, isActive }) => ({
        url: `/libraries/${libraryId}/qr-codes/${qrCodeId}`,
        method: 'PATCH',
        data: { is_active: isActive },
      }),
      invalidatesTags: ['QrCode'],
    }),
  }),
})

export const { useListQrCodesQuery, useGenerateQrCodeMutation, useSetQrCodeActiveMutation } = qrCodesApi
