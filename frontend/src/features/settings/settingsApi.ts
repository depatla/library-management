import { baseApi } from '@/shared/api/baseApi'

export interface StaffMember {
  user_id: string
  full_name: string
  email: string
  role_name: string
  status: string
  invited_at: string
  joined_at: string | null
}

export interface StaffInviteRequest {
  full_name: string
  email: string
  role_name: 'library_owner' | 'manager' | 'staff'
}

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listStaff: builder.query<StaffMember[], string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/settings/staff`, method: 'GET' }),
      providesTags: ['Staff'],
    }),
    inviteStaff: builder.mutation<StaffMember, { libraryId: string; body: StaffInviteRequest }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/settings/staff/invite`, method: 'POST', data: body }),
      invalidatesTags: ['Staff'],
    }),
    updateStaffRole: builder.mutation<StaffMember, { libraryId: string; userId: string; roleName: string }>({
      query: ({ libraryId, userId, roleName }) => ({
        url: `/libraries/${libraryId}/settings/staff/${userId}/role`,
        method: 'PATCH',
        data: { role_name: roleName },
      }),
      invalidatesTags: ['Staff'],
    }),
    removeStaff: builder.mutation<void, { libraryId: string; userId: string }>({
      query: ({ libraryId, userId }) => ({ url: `/libraries/${libraryId}/settings/staff/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['Staff'],
    }),
  }),
})

export const { useListStaffQuery, useInviteStaffMutation, useUpdateStaffRoleMutation, useRemoveStaffMutation } = settingsApi
