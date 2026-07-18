import { baseApi } from '@/shared/api/baseApi'
import type { Page } from '@/features/rooms-cabins/roomsCabinsApi'

export interface Student {
  id: string
  library_id: string
  cabin_id: string | null
  cabin_number: string | null
  room_category_name: string | null
  locker_id: string | null
  locker_number: string | null
  full_name: string
  phone: string
  whatsapp_number: string | null
  email: string | null
  gender: string | null
  address: string | null
  photo_url: string | null
  id_proof_url: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  joined_date: string | null
  expiry_date: string | null
  status: string
  created_by: string | null
  created_by_name: string | null
}

export interface StudentCreate {
  full_name: string
  phone: string
  whatsapp_number?: string | null
  email?: string | null
  gender?: string | null
  address?: string | null
  photo_url?: string | null
  id_proof_url?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  cabin_id?: string | null
  locker_id?: string | null
}

export type StudentUpdate = Partial<Omit<StudentCreate, 'cabin_id' | 'locker_id'>>

export const studentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listStudents: builder.query<
      Page<Student>,
      { libraryId: string; page: number; pageSize: number; status?: string; search?: string; expiringBefore?: string }
    >({
      query: ({ libraryId, page, pageSize, status, search, expiringBefore }) => ({
        url: `/libraries/${libraryId}/students`,
        method: 'GET',
        params: { page, page_size: pageSize, status, search, expiring_before: expiringBefore },
      }),
      providesTags: ['Student'],
    }),
    getStudent: builder.query<Student, { libraryId: string; studentId: string }>({
      query: ({ libraryId, studentId }) => ({ url: `/libraries/${libraryId}/students/${studentId}`, method: 'GET' }),
      providesTags: (_r, _e, { studentId }) => [{ type: 'Student', id: studentId }],
    }),
    createStudent: builder.mutation<Student, { libraryId: string; body: StudentCreate }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/students`, method: 'POST', data: body }),
      invalidatesTags: ['Student'],
    }),
    updateStudent: builder.mutation<Student, { libraryId: string; studentId: string; body: StudentUpdate }>({
      query: ({ libraryId, studentId, body }) => ({ url: `/libraries/${libraryId}/students/${studentId}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Student'],
    }),
    deleteStudent: builder.mutation<void, { libraryId: string; studentId: string }>({
      query: ({ libraryId, studentId }) => ({ url: `/libraries/${libraryId}/students/${studentId}`, method: 'DELETE' }),
      invalidatesTags: ['Student'],
    }),
    assignCabin: builder.mutation<Student, { libraryId: string; studentId: string; cabinId: string | null }>({
      query: ({ libraryId, studentId, cabinId }) => ({
        url: `/libraries/${libraryId}/students/${studentId}/assign-cabin`,
        method: 'POST',
        data: { cabin_id: cabinId },
      }),
      invalidatesTags: ['Student', 'Cabin'],
    }),
    assignLocker: builder.mutation<Student, { libraryId: string; studentId: string; lockerId: string | null }>({
      query: ({ libraryId, studentId, lockerId }) => ({
        url: `/libraries/${libraryId}/students/${studentId}/assign-locker`,
        method: 'POST',
        data: { locker_id: lockerId },
      }),
      invalidatesTags: ['Student', 'Locker'],
    }),
    setStudentStatus: builder.mutation<Student, { libraryId: string; studentId: string; status: string }>({
      query: ({ libraryId, studentId, status }) => ({
        url: `/libraries/${libraryId}/students/${studentId}/status`,
        method: 'POST',
        data: { status },
      }),
      invalidatesTags: ['Student'],
    }),
  }),
})

export const {
  useListStudentsQuery,
  useGetStudentQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useAssignCabinMutation,
  useAssignLockerMutation,
  useSetStudentStatusMutation,
} = studentsApi
