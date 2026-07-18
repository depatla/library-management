import { useState } from 'react'
import { z } from 'zod'
import { Button, Chip } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import { useListWhatsappMessagesQuery, useSendWhatsappMessageMutation, TEMPLATE_TYPES, type WhatsappMessage, type TemplateType } from './whatsappApi'
import { useListStudentsQuery } from '@/features/students/studentsApi'

const statusColors: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
  queued: 'default',
  sent: 'success',
  delivered: 'success',
  failed: 'error',
  read: 'success',
}

const sendSchema = z.object({
  student_id: z.string().min(1, 'Student is required'),
  template_type: z.string().min(1, 'Template type is required'),
})

type SendForm = z.infer<typeof sendSchema>

export function MessagesTab({ libraryId }: { libraryId: string }) {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
  const { data, isLoading } = useListWhatsappMessagesQuery({ libraryId, page: paginationModel.page + 1, pageSize: paginationModel.pageSize })
  const { data: studentsPage } = useListStudentsQuery({ libraryId, page: 1, pageSize: 100 })
  const [sendMessage, { isLoading: isSending }] = useSendWhatsappMessageMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const studentOptions = (studentsPage?.items ?? []).map((s) => ({ value: s.id, label: s.full_name }))
  const templateOptions = TEMPLATE_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))

  const sendFields: CrudField[] = [
    { name: 'student_id', label: 'Student', type: 'select', options: studentOptions, required: true },
    { name: 'template_type', label: 'Template', type: 'select', options: templateOptions, required: true },
  ]

  const columns: GridColDef<WhatsappMessage>[] = [
    { field: 'phone', headerName: 'Phone', width: 140 },
    { field: 'message_body', headerName: 'Message', flex: 1, minWidth: 220 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => <Chip size="small" label={params.value} color={statusColors[params.value] ?? 'default'} />,
    },
    { field: 'sent_at', headerName: 'Sent at', width: 180, valueGetter: (v) => (v ? new Date(v).toLocaleString() : '—') },
  ]

  async function handleSend(values: SendForm) {
    try {
      await sendMessage({ libraryId, studentId: values.student_id, templateType: values.template_type as TemplateType }).unwrap()
      notify('Message sent')
      setDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  return (
    <>
      <CrudListPage
        title="Messages"
        subtitle="WhatsApp message history"
        columns={columns}
        rows={data?.items ?? []}
        rowCount={data?.total ?? 0}
        loading={isLoading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        extraToolbar={
          <Button
            variant="contained"
            size="small"
            startIcon={<SendIcon />}
            onClick={() => {
              setServerError(null)
              setDialogOpen(true)
            }}
          >
            Send message
          </Button>
        }
      />

      <CrudFormDialog<SendForm>
        open={dialogOpen}
        title="Send WhatsApp message"
        fields={sendFields}
        schema={sendSchema}
        defaultValues={{ student_id: '', template_type: 'welcome' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSend}
        isSubmitting={isSending}
        serverError={serverError}
        submitLabel="Send"
      />

      {SnackbarElement}
    </>
  )
}
