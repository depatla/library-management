import { useEffect, useState } from 'react'
import { z } from 'zod'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import type { GridColDef } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { ConfirmDialog } from '@/shared/crud/ConfirmDialog'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import {
  useListTemplatesQuery,
  useLazyListContentTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  TEMPLATE_TYPES,
  type ContentTemplate,
  type Template,
  type TemplateType,
  type VariableSource,
} from './whatsappApi'

const TYPE_OPTIONS = TEMPLATE_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))

const VARIABLE_SOURCE_OPTIONS = [
  { value: 'name', label: 'Student name' },
  { value: 'expiry_date', label: 'Expiry date' },
  { value: 'cabin_number', label: 'Desk/cabin number' },
  { value: 'custom', label: 'Custom text…' },
]

const APPROVAL_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
}

function detectVariableNumbers(body: string): string[] {
  const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])
  return [...new Set(matches)].sort((a, b) => Number(a) - Number(b))
}

const createSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  name: z.string().min(1, 'Name is required').max(100),
  content: z.string(),
})

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  content: z.string(),
  is_active: z.boolean(),
})

type CreateForm = z.infer<typeof createSchema>
type UpdateForm = z.infer<typeof updateSchema>

const CONTENT_HELPER = 'Freeform fallback — use {{name}} and {{expiry_date}} placeholders. Optional if you load an approved template from Twilio below.'

const createFields: CrudField[] = [
  { name: 'type', label: 'Type', type: 'select', options: TYPE_OPTIONS, required: true },
  { name: 'name', label: 'Template name', type: 'text', required: true },
  { name: 'content', label: 'Content', type: 'textarea', helperText: CONTENT_HELPER },
]

const updateFields: CrudField[] = [
  { name: 'name', label: 'Template name', type: 'text', required: true },
  { name: 'content', label: 'Content', type: 'textarea', helperText: CONTENT_HELPER },
  { name: 'is_active', label: 'Active', type: 'boolean' },
]

/** Content API picker + variable-mapping rows, shared by the create and edit dialogs
 * via CrudFormDialog's `extra` slot — selecting an approved template sets `content_sid`
 * and lets staff map each {{N}} variable to a known field instead of retyping wording. */
function ContentTemplatePicker({
  libraryId,
  contentSid,
  variableMapping,
  onChange,
}: {
  libraryId: string
  contentSid: string | null
  variableMapping: Record<string, VariableSource>
  onChange: (contentSid: string | null, variableMapping: Record<string, VariableSource>) => void
}) {
  const [fetchContentTemplates, { data: contentTemplates, isFetching, error }] = useLazyListContentTemplatesQuery()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedBody, setSelectedBody] = useState<string | null>(null)

  const variableNumbers = Object.keys(variableMapping).sort((a, b) => Number(a) - Number(b))

  function openPicker() {
    setPickerOpen(true)
    fetchContentTemplates(libraryId)
  }

  function selectTemplate(template: ContentTemplate) {
    const numbers = detectVariableNumbers(template.body)
    onChange(
      template.sid,
      Object.fromEntries(numbers.map((n) => [n, variableMapping[n] ?? '']))
    )
    setSelectedBody(template.body)
    setPickerOpen(false)
  }

  function updateVariable(number: string, source: VariableSource) {
    onChange(contentSid, { ...variableMapping, [number]: source })
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField label="Content SID (Twilio-approved template)" value={contentSid ?? ''} disabled fullWidth size="small" />
        <Button variant="outlined" startIcon={<CloudDownloadIcon />} onClick={openPicker} sx={{ whiteSpace: 'nowrap' }}>
          Load from Twilio
        </Button>
      </Stack>

      {contentSid && (
        <>
          {selectedBody && (
            <TextField label="Approved message body" value={selectedBody} disabled multiline minRows={2} fullWidth size="small" />
          )}
          {variableNumbers.length > 0 && (
            <Stack spacing={1.5}>
              <Typography variant="caption" color="text.secondary">
                Map each variable in the approved template to a field
              </Typography>
              {variableNumbers.map((number) => {
                const source = variableMapping[number]
                const isCustom = typeof source === 'object'
                const selectValue = isCustom ? 'custom' : source || ''
                return (
                  <Stack key={number} direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="body2" sx={{ minWidth: 48 }}>{`{{${number}}} →`}</Typography>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={selectValue}
                      onChange={(e) => updateVariable(number, e.target.value === 'custom' ? { custom: '' } : e.target.value)}
                    >
                      {VARIABLE_SOURCE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    {isCustom && (
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Literal text"
                        value={(source as { custom: string }).custom}
                        onChange={(e) => updateVariable(number, { custom: e.target.value })}
                      />
                    )}
                  </Stack>
                )
              })}
            </Stack>
          )}
        </>
      )}

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Select an approved template
          <IconButton size="small" onClick={() => setPickerOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {isFetching && <Typography color="text.secondary">Loading templates from Twilio…</Typography>}
          {error && <Alert severity="error">Could not fetch templates. Check the WhatsApp config on the Config tab.</Alert>}
          {contentTemplates && contentTemplates.length === 0 && (
            <Typography color="text.secondary">No Content API templates found on this Twilio account.</Typography>
          )}
          {contentTemplates && contentTemplates.length > 0 && (
            <List disablePadding>
              {contentTemplates.map((t) => (
                <ListItemButton key={t.sid} onClick={() => selectTemplate(t)} sx={{ borderRadius: 1, mb: 0.5 }}>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={600}>{t.friendly_name}</Typography>
                        {t.approval_status && (
                          <Chip
                            size="small"
                            label={t.approval_status}
                            color={APPROVAL_COLOR[t.approval_status.toLowerCase()] ?? 'default'}
                          />
                        )}
                      </Stack>
                    }
                    secondary={t.body}
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  )
}

export function TemplatesTab({ libraryId }: { libraryId: string }) {
  const { data: templates, isLoading } = useListTemplatesQuery(libraryId)
  const [createTemplate, { isLoading: isCreating }] = useCreateTemplateMutation()
  const [updateTemplate, { isLoading: isUpdating }] = useUpdateTemplateMutation()
  const [deleteTemplate] = useDeleteTemplateMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState<Template | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const [contentSid, setContentSid] = useState<string | null>(null)
  const [variableMapping, setVariableMapping] = useState<Record<string, VariableSource>>({})

  useEffect(() => {
    if (editing) {
      setContentSid(editing.content_sid ?? null)
      setVariableMapping(editing.variable_mapping ?? {})
    }
  }, [editing])

  function handlePickerChange(sid: string | null, mapping: Record<string, VariableSource>) {
    setContentSid(sid)
    setVariableMapping(mapping)
  }

  const columns: GridColDef<Template>[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'type', headerName: 'Type', width: 160, renderCell: (params) => <Chip size="small" label={params.value.replace(/_/g, ' ')} /> },
    {
      field: 'content_sid',
      headerName: 'Content API',
      width: 120,
      renderCell: (params) => <Chip size="small" label={params.value ? 'Yes' : 'Freeform'} color={params.value ? 'info' : 'default'} />,
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => <Chip size="small" label={params.value ? 'Active' : 'Inactive'} color={params.value ? 'success' : 'default'} />,
    },
  ]

  async function handleCreate(values: CreateForm) {
    if (!values.content.trim() && !contentSid) {
      setServerError('Provide freeform content or load an approved template from Twilio')
      return
    }
    try {
      await createTemplate({
        libraryId,
        body: { ...values, type: values.type as TemplateType, content_sid: contentSid, variable_mapping: variableMapping },
      }).unwrap()
      notify('Template created')
      setDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleUpdate(values: UpdateForm) {
    if (!editing) return
    if (!values.content.trim() && !contentSid) {
      setServerError('Provide freeform content or load an approved template from Twilio')
      return
    }
    try {
      await updateTemplate({
        libraryId,
        templateId: editing.id,
        body: { ...values, content_sid: contentSid, variable_mapping: variableMapping },
      }).unwrap()
      notify('Template updated')
      setEditing(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteTemplate({ libraryId, templateId: deleting.id }).unwrap()
      notify('Template deleted')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <CrudListPage
        title="Message Templates"
        subtitle="Reusable WhatsApp message templates"
        columns={columns}
        rows={templates ?? []}
        rowCount={templates?.length ?? 0}
        loading={isLoading}
        paginationModel={{ page: 0, pageSize: 100 }}
        onPaginationModelChange={() => {}}
        onAdd={() => {
          setServerError(null)
          setContentSid(null)
          setVariableMapping({})
          setDialogOpen(true)
        }}
        addLabel="Add template"
        onEdit={(row) => {
          setServerError(null)
          setEditing(row)
        }}
        onDelete={(row) => setDeleting(row)}
      />

      <CrudFormDialog<CreateForm>
        open={dialogOpen}
        title="Add template"
        fields={createFields}
        schema={createSchema}
        defaultValues={{ type: 'welcome', name: '', content: '' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        serverError={serverError}
        extra={
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Content API (recommended for library-initiated sends)</Typography>
            <ContentTemplatePicker libraryId={libraryId} contentSid={contentSid} variableMapping={variableMapping} onChange={handlePickerChange} />
          </Box>
        }
      />

      <CrudFormDialog<UpdateForm>
        open={Boolean(editing)}
        title="Edit template"
        fields={updateFields}
        schema={updateSchema}
        defaultValues={{ name: editing?.name ?? '', content: editing?.content ?? '', is_active: editing?.is_active ?? true }}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        serverError={serverError}
        extra={
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Content API (recommended for library-initiated sends)</Typography>
            <ContentTemplatePicker libraryId={libraryId} contentSid={contentSid} variableMapping={variableMapping} onChange={handlePickerChange} />
          </Box>
        }
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete template"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      {SnackbarElement}
    </>
  )
}
