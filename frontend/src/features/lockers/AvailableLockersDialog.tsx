import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/DownloadOutlined'
import { downloadAvailableLockersPdf, useListAvailableLockersQuery } from './lockersApi'
import { extractErrorMessage } from '@/shared/crud/useCrudSnackbar'

interface AvailableLockersDialogProps {
  open: boolean
  libraryId: string
  onClose: () => void
}

export function AvailableLockersDialog({ open, libraryId, onClose }: AvailableLockersDialogProps) {
  const { data: lockers, isLoading } = useListAvailableLockersQuery(libraryId, { skip: !open })
  const [isDownloading, setIsDownloading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  async function handleDownloadPdf() {
    setServerError(null)
    setIsDownloading(true)
    try {
      await downloadAvailableLockersPdf(libraryId)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    } finally {
      setIsDownloading(false)
    }
  }

  const total = lockers?.length ?? 0

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Available lockers
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {isLoading && <Typography color="text.secondary">Loading available lockers…</Typography>}

          {!isLoading && lockers?.length === 0 && <Alert severity="info">No lockers are currently available.</Alert>}

          {!isLoading && lockers && lockers.length > 0 && (
            <>
              <Typography variant="body2" color="text.secondary">
                {total} locker{total === 1 ? '' : 's'} available.
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                  gap: 1,
                }}
              >
                {lockers.map((locker) => (
                  <Box
                    key={locker.locker_number}
                    sx={{
                      textAlign: 'center',
                      py: 1,
                      borderRadius: 1,
                      border: '2px solid',
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {locker.locker_number}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}

          {serverError && <Alert severity="error">{serverError}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadPdf}
          disabled={isDownloading || isLoading || total === 0}
        >
          Download PDF
        </Button>
      </DialogActions>
    </Dialog>
  )
}
