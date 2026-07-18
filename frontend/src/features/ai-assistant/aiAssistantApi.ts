import { baseApi } from '@/shared/api/baseApi'
import type { Page } from '@/features/rooms-cabins/roomsCabinsApi'

export interface AiQueryLog {
  id: string
  library_id: string
  user_id: string
  question: string
  matched_intent: string
  answer: string
  created_at: string
}

export const aiAssistantApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    askAi: builder.mutation<{ answer: string; matched_intent: string }, { libraryId: string; question: string }>({
      query: ({ libraryId, question }) => ({ url: `/libraries/${libraryId}/ai/ask`, method: 'POST', data: { question } }),
      invalidatesTags: ['AiLog'],
    }),
    listAiHistory: builder.query<Page<AiQueryLog>, { libraryId: string; page: number; pageSize: number }>({
      query: ({ libraryId, page, pageSize }) => ({
        url: `/libraries/${libraryId}/ai/history`,
        method: 'GET',
        params: { page, page_size: pageSize },
      }),
      providesTags: ['AiLog'],
    }),
  }),
})

export const { useAskAiMutation, useListAiHistoryQuery } = aiAssistantApi
