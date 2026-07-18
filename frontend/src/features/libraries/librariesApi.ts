import { baseApi } from '@/shared/api/baseApi'

export interface Library {
  id: string
  name: string
  slug: string
  city: string | null
  status: string
  primary_color: string
  secondary_color: string
  theme_mode: 'light' | 'dark'
  owner_id: string
  owner_name: string
  created_at: string
}

export interface CreateLibraryRequest {
  name: string
  address_line1?: string
  city?: string
  state?: string
  postal_code?: string
  phone?: string
  email?: string
  primary_color?: string
  secondary_color?: string
  theme_mode?: 'light' | 'dark'
  owner: {
    full_name: string
    email: string
    phone?: string
    password: string
  }
}

export interface UpdateLibraryThemeRequest {
  primary_color?: string
  secondary_color?: string
  theme_mode?: 'light' | 'dark'
}

export const librariesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyLibraries: builder.query<Library[], void>({
      query: () => ({ url: '/libraries/mine', method: 'GET' }),
      providesTags: ['Library'],
    }),
    getAllLibraries: builder.query<Library[], void>({
      query: () => ({ url: '/libraries', method: 'GET' }),
      providesTags: ['Library'],
    }),
    getLibrary: builder.query<Library, string>({
      query: (id) => ({ url: `/libraries/${id}`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'Library', id }],
    }),
    createLibrary: builder.mutation<Library, CreateLibraryRequest>({
      query: (body) => ({ url: '/libraries', method: 'POST', data: body }),
      invalidatesTags: ['Library'],
    }),
    activateLibrary: builder.mutation<Library, string>({
      query: (id) => ({ url: `/libraries/${id}/activate`, method: 'POST' }),
      invalidatesTags: ['Library'],
    }),
    deactivateLibrary: builder.mutation<Library, string>({
      query: (id) => ({ url: `/libraries/${id}/deactivate`, method: 'POST' }),
      invalidatesTags: ['Library'],
    }),
    updateLibraryTheme: builder.mutation<Library, { libraryId: string; body: UpdateLibraryThemeRequest }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/theme`, method: 'PATCH', data: body }),
      invalidatesTags: (_r, _e, { libraryId }) => [{ type: 'Library', id: libraryId }, 'Library'],
    }),
  }),
})

export const {
  useGetMyLibrariesQuery,
  useGetAllLibrariesQuery,
  useGetLibraryQuery,
  useCreateLibraryMutation,
  useActivateLibraryMutation,
  useDeactivateLibraryMutation,
  useUpdateLibraryThemeMutation,
} = librariesApi
