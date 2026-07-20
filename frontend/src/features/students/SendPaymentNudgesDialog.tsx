import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import dayjs from 'dayjs'
import { useListPendingPaymentStudentsQuery } from './studentsApi'
import { useListTemplatesQuery, useSendBulkWhatsappMessagesMutation, type BulkSendResult, type TemplateType } from '@/features/whatsapp/whatsappApi'
import { extractErrorMessage } from '@/shared/crud/useCrudSnackbar'

interface SendPaymentNudgesDialogProps {
  open: boolean
  libraryId: string
  onClose: () => void
}

export function SendPaymentNudgesDialog({ open, libraryId, onClose }: SendPaymentNudgesDialogProps) {
  const { data: pendingStudents, isLoading: isLoadingStudents } = useListPendingPaymentStudentsQuery(libraryId, { skip: !open })
  const { data: templates, isLoading: isLoadingTemplates } = useListTemplatesQuery(libraryId, { skip: !open })
  const [sendBulk, { isLoading: isSending }] = useSendBulkWhatsappMessagesMutation()

  const activeTemplates = useMemo(() => (templates ?? []).filter((t) => t.is_active), [templates])

  const [templateType, setTemplateType] = useState<TemplateType | ''>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<BulkSendResult | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setResult(null)
    setServerError(null)
  }, [open])

  useEffect(() => {
    if (pendingStudents) setSelectedIds(new Set(pendingStudents.map((s) => s.id)))
  }, [pendingStudents])

  useEffect(() => {
    if (!templateType && activeTemplates.length > 0) {
      const paymentReminder = activeTemplates.find((t) => t.type === 'payment_reminder')
      setTemplateType((paymentReminder ?? activeTemplates[0]).type)
    }
  }, [activeTemplates, templateType])

  function reset() {
    setTemplateType('')
    setSelectedIds(new Set())
    setResult(null)
    setServerError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (!pendingStudents) return
    setSelectedIds((prev) => (prev.size === pendingStudents.length ? new Set() : new Set(pendingStudents.map((s) => s.id))))
  }

  async function handleSend() {
    if (!templateType || selectedIds.size === 0) return
    setServerError(null)
    try {
      const sendResult = await sendBulk({ libraryId, templateType, studentIds: [...selectedIds] }).unwrap()
      setResult(sendResult)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  const allSelected = Boolean(pendingStudents?.length) && selectedIds.size === pendingStudents!.length

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Send payment nudges
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Choose a WhatsApp template, then uncheck anyone you don't want to nudge right now.
          </Typography>

          <TextField
            select
            label="Template"
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value as TemplateType)}
            disabled={isLoadingTemplates || activeTemplates.length === 0}
            size="small"
            fullWidth
          >
            {activeTemplates.map((t) => (
              <MenuItem key={t.id} value={t.type}>
                {t.name} ({t.type.replace(/_/g, ' ')})
              </MenuItem>
            ))}
          </TextField>
          {!isLoadingTemplates && activeTemplates.length === 0 && (
            <Alert severity="warning">No active WhatsApp templates configured — add one on the WhatsApp page first.</Alert>
          )}

          <Divider />

          {isLoadingStudents && <Typography color="text.secondary">Loading students with pending payments…</Typography>}

          {!isLoadingStudents && pendingStudents?.length === 0 && (
            <Alert severity="success">No students currently have a pending payment.</Alert>
          )}

          {!isLoadingStudents && pendingStudents && pendingStudents.length > 0 && (
            <Box>
              <FormControlLabel
                control={<Checkbox checked={allSelected} indeterminate={selectedIds.size > 0 && !allSelected} onChange={toggleAll} />}
                label={`${selectedIds.size} of ${pendingStudents.length} selected`}
              />
              <List dense sx={{ maxHeight: 280, overflowY: 'auto', bgcolor: 'action.hover', borderRadius: 1 }}>
                {pendingStudents.map((student) => (
                  <ListItem key={student.id} disablePadding sx={{ px: 1 }}>
                    <FormControlLabel
                      sx={{ width: '100%', mr: 0 }}
                      control={<Checkbox checked={selectedIds.has(student.id)} onChange={() => toggleStudent(student.id)} />}
                      label={
                        <ListItemText
                          primary={student.full_name}
                          secondary={`${student.phone} · expired ${dayjs(student.expiry_date).format('DD MMM YYYY')}`}
                        />
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {serverError && <Alert severity="error">{serverError}</Alert>}

          {result && (
            <Box>
              <Alert severity={result.failed_count > 0 ? 'warning' : 'success'} sx={{ mb: 1 }}>
                {result.sent_count} message{result.sent_count === 1 ? '' : 's'} sent
                {result.failed_count > 0 ? `, ${result.failed_count} failed` : ''}.
              </Alert>
              {result.results.filter((r) => !r.success).length > 0 && (
                <List dense sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: 'action.hover', borderRadius: 1 }}>
                  {result.results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <ListItem key={r.student_id}>
                        <ListItemText primary={r.name ?? r.student_id} secondary={r.error} />
                      </ListItem>
                    ))}
                </List>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose}>Close</Button>
        <Button variant="contained" onClick={handleSend} disabled={!templateType || selectedIds.size === 0 || isSending}>
          Send to {selectedIds.size}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
