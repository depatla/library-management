import { baseApi } from '@/shared/api/baseApi'
import type { Page } from '@/features/rooms-cabins/roomsCabinsApi'

export const TEMPLATE_TYPES = ['welcome', 'payment_reminder', 'renewal_reminder', 'expiry_reminder', 'thank_you', 'custom'] as const
export type TemplateType = (typeof TEMPLATE_TYPES)[number]

export interface TwilioConfig {
  id: string
  library_id: string
  account_sid: string
  auth_token_masked: string
  whatsapp_number: string
  is_active: boolean
}

export interface TwilioConfigCreate {
  account_sid: string
  auth_token: string
  whatsapp_number: string
  is_active?: boolean
}

export type VariableSource = string | { custom: string }

export interface Template {
  id: string
  library_id: string
  type: TemplateType
  name: string
  content: string
  content_sid: string | null
  variable_mapping: Record<string, VariableSource>
  is_active: boolean
}

export interface TemplateCreate {
  type: TemplateType
  name: string
  content: string
  content_sid?: string | null
  variable_mapping?: Record<string, VariableSource>
  is_active?: boolean
}

export type TemplateUpdate = Partial<Omit<TemplateCreate, 'type'>>

export interface ContentTemplate {
  sid: string
  friendly_name: string
  language: string
  variables: Record<string, string>
  body: string
  approval_status: string | null
}

export interface WhatsappMessage {
  id: string
  library_id: string
  student_id: string | null
  template_id: string | null
  phone: string
  message_body: string
  status: string
  provider_message_sid: string | null
  error_message: string | null
  direction: 'outbound' | 'inbound'
  retry_count: number
  sent_at: string | null
}

export interface BulkSendRowResult {
  student_id: string
  name: string | null
  success: boolean
  error: string | null
}

export interface BulkSendResult {
  sent_count: number
  failed_count: number
  results: BulkSendRowResult[]
}

export const whatsappApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWhatsappConfig: builder.query<TwilioConfig | null, string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/whatsapp/config`, method: 'GET' }),
      providesTags: ['WhatsappConfig'],
    }),
    upsertWhatsappConfig: builder.mutation<TwilioConfig, { libraryId: string; body: TwilioConfigCreate }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/whatsapp/config`, method: 'PUT', data: body }),
      invalidatesTags: ['WhatsappConfig'],
    }),
    listTemplates: builder.query<Template[], string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/whatsapp/templates`, method: 'GET' }),
      providesTags: ['WhatsappTemplate'],
    }),
    listContentTemplates: builder.query<ContentTemplate[], string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/whatsapp/content-templates`, method: 'GET' }),
    }),
    createTemplate: builder.mutation<Template, { libraryId: string; body: TemplateCreate }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/whatsapp/templates`, method: 'POST', data: body }),
      invalidatesTags: ['WhatsappTemplate'],
    }),
    updateTemplate: builder.mutation<Template, { libraryId: string; templateId: string; body: TemplateUpdate }>({
      query: ({ libraryId, templateId, body }) => ({
        url: `/libraries/${libraryId}/whatsapp/templates/${templateId}`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: ['WhatsappTemplate'],
    }),
    deleteTemplate: builder.mutation<void, { libraryId: string; templateId: string }>({
      query: ({ libraryId, templateId }) => ({ url: `/libraries/${libraryId}/whatsapp/templates/${templateId}`, method: 'DELETE' }),
      invalidatesTags: ['WhatsappTemplate'],
    }),
    sendWhatsappMessage: builder.mutation<WhatsappMessage, { libraryId: string; studentId: string; templateType: TemplateType }>({
      query: ({ libraryId, studentId, templateType }) => ({
        url: `/libraries/${libraryId}/whatsapp/send`,
        method: 'POST',
        data: { student_id: studentId, template_type: templateType },
      }),
      invalidatesTags: ['WhatsappMessage'],
    }),
    sendBulkWhatsappMessages: builder.mutation<BulkSendResult, { libraryId: string; templateType: TemplateType; studentIds: string[] }>({
      query: ({ libraryId, templateType, studentIds }) => ({
        url: `/libraries/${libraryId}/whatsapp/send-bulk`,
        method: 'POST',
        data: { template_type: templateType, student_ids: studentIds },
      }),
      invalidatesTags: ['WhatsappMessage', 'Student'],
    }),
    listWhatsappMessages: builder.query<Page<WhatsappMessage>, { libraryId: string; page: number; pageSize: number }>({
      query: ({ libraryId, page, pageSize }) => ({
        url: `/libraries/${libraryId}/whatsapp/messages`,
        method: 'GET',
        params: { page, page_size: pageSize },
      }),
      providesTags: ['WhatsappMessage'],
    }),
  }),
})

export const {
  useGetWhatsappConfigQuery,
  useUpsertWhatsappConfigMutation,
  useListTemplatesQuery,
  useLazyListContentTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useSendWhatsappMessageMutation,
  useSendBulkWhatsappMessagesMutation,
  useListWhatsappMessagesQuery,
} = whatsappApi
