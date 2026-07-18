import { useParams } from 'react-router-dom'
import { Box, Button, Card, CardContent, CardMedia, Chip, Grid, Skeleton, Stack, Switch, Typography } from '@mui/material'
import QrCode2Icon from '@mui/icons-material/QrCode2Outlined'
import { motion } from 'framer-motion'
import { useListQrCodesQuery, useGenerateQrCodeMutation, useSetQrCodeActiveMutation, type QrCode } from './qrCodesApi'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'

const QR_TYPES: { type: 'seat_availability' | 'complaint'; label: string; description: string }[] = [
  { type: 'seat_availability', label: 'Seat Availability', description: 'Students scan to check live seat & locker availability' },
  { type: 'complaint', label: 'Complaint / Suggestion', description: 'Students scan to submit a complaint or suggestion' },
]

export function QrCodesPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const { data: qrCodes, isLoading } = useListQrCodesQuery(libraryId!)
  const [generateQrCode, { isLoading: isGenerating }] = useGenerateQrCodeMutation()
  const [setActive] = useSetQrCodeActiveMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  function findQr(type: string): QrCode | undefined {
    return qrCodes?.find((q) => q.type === type)
  }

  async function handleGenerate(type: 'seat_availability' | 'complaint') {
    try {
      await generateQrCode({ libraryId: libraryId!, type }).unwrap()
      notify('QR code generated')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    }
  }

  async function handleToggle(qr: QrCode) {
    try {
      await setActive({ libraryId: libraryId!, qrCodeId: qr.id, isActive: !qr.is_active }).unwrap()
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    }
  }

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          QR Codes
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Public QR codes for seat availability and complaints — no login required for students
        </Typography>

        <Grid container spacing={2}>
          {QR_TYPES.map((qt, i) => {
            const qr = findQr(qt.type)
            return (
              <Grid key={qt.type} size={{ xs: 12, sm: 6 }}>
                <Card
                  component={motion.div}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  variant="outlined"
                  sx={{ borderRadius: 3 }}
                >
                  {isLoading ? (
                    <Skeleton variant="rectangular" height={220} />
                  ) : qr?.image_url ? (
                    <CardMedia component="img" image={qr.image_url} alt={qt.label} sx={{ height: 220, objectFit: 'contain', p: 2 }} />
                  ) : (
                    <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                      <QrCode2Icon sx={{ fontSize: 64, color: 'text.disabled' }} />
                    </Box>
                  )}
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle1" fontWeight={700}>
                        {qt.label}
                      </Typography>
                      {qr && (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Switch size="small" checked={qr.is_active} onChange={() => handleToggle(qr)} />
                          <Chip size="small" label={qr.is_active ? 'Active' : 'Inactive'} color={qr.is_active ? 'success' : 'default'} />
                        </Stack>
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {qt.description}
                    </Typography>
                    <Button variant="outlined" fullWidth onClick={() => handleGenerate(qt.type)} disabled={isGenerating}>
                      {qr ? 'Regenerate' : 'Generate'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      </Box>
      {SnackbarElement}
    </>
  )
}
