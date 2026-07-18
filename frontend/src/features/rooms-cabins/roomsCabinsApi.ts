import { baseApi } from '@/shared/api/baseApi'
import { apiClient } from '@/shared/api/apiClient'

export interface RoomCategory {
  id: string
  library_id: string
  name: string
  color_code: string | null
  is_ac: boolean
  is_ac_locked: boolean
  is_default: boolean
  display_order: number
}

export interface RoomCategoryCreate {
  name: string
  color_code?: string | null
  is_ac?: boolean
  is_ac_locked?: boolean
  display_order?: number
}

export interface RoomCategoryUpdate {
  name?: string
  color_code?: string | null
  display_order?: number
}

export interface Cabin {
  id: string
  library_id: string
  room_category_id: string
  room_category_name: string
  cabin_number: string
  capacity: number
  status: string
}

export interface CabinCreate {
  room_category_id: string
  cabin_number: string
}

export interface CabinUpdate {
  cabin_number?: string
  capacity?: number
  status?: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface CabinBulkUploadRowError {
  row_number: number
  cabin_number: string | null
  room_category: string | null
  error: string
}

export interface CabinBulkUploadResult {
  created_count: number
  error_count: number
  errors: CabinBulkUploadRowError[]
}

export async function downloadCabinSampleCsv(libraryId: string): Promise<void> {
  const response = await apiClient.get(`/libraries/${libraryId}/cabins/bulk-upload/sample`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = 'cabins_sample.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const roomsCabinsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listRoomCategories: builder.query<RoomCategory[], string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/room-categories`, method: 'GET' }),
      providesTags: ['RoomCategory'],
    }),
    createRoomCategory: builder.mutation<RoomCategory, { libraryId: string; body: RoomCategoryCreate }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/room-categories`, method: 'POST', data: body }),
      invalidatesTags: ['RoomCategory'],
    }),
    updateRoomCategory: builder.mutation<RoomCategory, { libraryId: string; categoryId: string; body: RoomCategoryUpdate }>({
      query: ({ libraryId, categoryId, body }) => ({
        url: `/libraries/${libraryId}/room-categories/${categoryId}`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: ['RoomCategory'],
    }),
    deleteRoomCategory: builder.mutation<void, { libraryId: string; categoryId: string }>({
      query: ({ libraryId, categoryId }) => ({ url: `/libraries/${libraryId}/room-categories/${categoryId}`, method: 'DELETE' }),
      invalidatesTags: ['RoomCategory'],
    }),
    toggleAc: builder.mutation<RoomCategory, { libraryId: string; categoryId: string; isAc: boolean }>({
      query: ({ libraryId, categoryId, isAc }) => ({
        url: `/libraries/${libraryId}/room-categories/${categoryId}/toggle-ac`,
        method: 'POST',
        params: { is_ac: isAc },
      }),
      invalidatesTags: ['RoomCategory'],
    }),
    bulkSeasonalFlip: builder.mutation<RoomCategory[], { libraryId: string; setAc: boolean }>({
      query: ({ libraryId, setAc }) => ({
        url: `/libraries/${libraryId}/room-categories/bulk-seasonal-flip`,
        method: 'POST',
        data: { set_ac: setAc },
      }),
      invalidatesTags: ['RoomCategory'],
    }),
    listCabins: builder.query<
      Page<Cabin>,
      { libraryId: string; page: number; pageSize: number; roomCategoryId?: string; status?: string; search?: string }
    >({
      query: ({ libraryId, page, pageSize, roomCategoryId, status, search }) => ({
        url: `/libraries/${libraryId}/cabins`,
        method: 'GET',
        params: { page, page_size: pageSize, room_category_id: roomCategoryId, status, search },
      }),
      providesTags: ['Cabin'],
    }),
    createCabin: builder.mutation<Cabin, { libraryId: string; body: CabinCreate }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/cabins`, method: 'POST', data: body }),
      invalidatesTags: ['Cabin'],
    }),
    updateCabin: builder.mutation<Cabin, { libraryId: string; cabinId: string; body: CabinUpdate }>({
      query: ({ libraryId, cabinId, body }) => ({ url: `/libraries/${libraryId}/cabins/${cabinId}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Cabin'],
    }),
    deleteCabin: builder.mutation<void, { libraryId: string; cabinId: string }>({
      query: ({ libraryId, cabinId }) => ({ url: `/libraries/${libraryId}/cabins/${cabinId}`, method: 'DELETE' }),
      invalidatesTags: ['Cabin'],
    }),
    bulkUploadCabins: builder.mutation<CabinBulkUploadResult, { libraryId: string; file: File }>({
      query: ({ libraryId, file }) => {
        const formData = new FormData()
        formData.append('file', file)
        return { url: `/libraries/${libraryId}/cabins/bulk-upload`, method: 'POST', data: formData }
      },
      invalidatesTags: ['Cabin'],
    }),
  }),
})

export const {
  useListRoomCategoriesQuery,
  useCreateRoomCategoryMutation,
  useUpdateRoomCategoryMutation,
  useDeleteRoomCategoryMutation,
  useToggleAcMutation,
  useBulkSeasonalFlipMutation,
  useListCabinsQuery,
  useCreateCabinMutation,
  useUpdateCabinMutation,
  useDeleteCabinMutation,
  useBulkUploadCabinsMutation,
} = roomsCabinsApi
