import { baseApi } from '@/shared/api/baseApi'
import { apiClient } from '@/shared/api/apiClient'
import type { Page } from '@/features/rooms-cabins/roomsCabinsApi'

export interface Locker {
  id: string
  library_id: string
  locker_number: string
  monthly_rent: number
  status: string
}

export interface LockerCreate {
  locker_number: string
  monthly_rent?: number
}

export interface LockerUpdate {
  locker_number?: string
  monthly_rent?: number
  status?: string
}

export interface LockerBulkUploadRowError {
  row_number: number
  locker_number: string | null
  error: string
}

export interface LockerBulkUploadResult {
  created_count: number
  error_count: number
  errors: LockerBulkUploadRowError[]
}

export interface AvailableLocker {
  locker_number: string
  monthly_rent: number
}

export async function downloadLockerSampleCsv(libraryId: string): Promise<void> {
  const response = await apiClient.get(`/libraries/${libraryId}/lockers/bulk-upload/sample`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = 'lockers_sample.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadAvailableLockersPdf(libraryId: string): Promise<void> {
  const response = await apiClient.get(`/libraries/${libraryId}/lockers/available/pdf`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = 'available-lockers.pdf'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const lockersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listLockers: builder.query<Page<Locker>, { libraryId: string; page: number; pageSize: number; status?: string }>({
      query: ({ libraryId, page, pageSize, status }) => ({
        url: `/libraries/${libraryId}/lockers`,
        method: 'GET',
        params: { page, page_size: pageSize, status },
      }),
      providesTags: ['Locker'],
    }),
    createLocker: builder.mutation<Locker, { libraryId: string; body: LockerCreate }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/lockers`, method: 'POST', data: body }),
      invalidatesTags: ['Locker'],
    }),
    updateLocker: builder.mutation<Locker, { libraryId: string; lockerId: string; body: LockerUpdate }>({
      query: ({ libraryId, lockerId, body }) => ({ url: `/libraries/${libraryId}/lockers/${lockerId}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Locker'],
    }),
    deleteLocker: builder.mutation<void, { libraryId: string; lockerId: string }>({
      query: ({ libraryId, lockerId }) => ({ url: `/libraries/${libraryId}/lockers/${lockerId}`, method: 'DELETE' }),
      invalidatesTags: ['Locker'],
    }),
    bulkUploadLockers: builder.mutation<LockerBulkUploadResult, { libraryId: string; file: File }>({
      query: ({ libraryId, file }) => {
        const formData = new FormData()
        formData.append('file', file)
        return { url: `/libraries/${libraryId}/lockers/bulk-upload`, method: 'POST', data: formData }
      },
      invalidatesTags: ['Locker'],
    }),
    listAvailableLockers: builder.query<AvailableLocker[], string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/lockers/available`, method: 'GET' }),
      providesTags: ['Locker'],
    }),
  }),
})

export const {
  useListLockersQuery,
  useCreateLockerMutation,
  useUpdateLockerMutation,
  useDeleteLockerMutation,
  useBulkUploadLockersMutation,
  useListAvailableLockersQuery,
} = lockersApi
