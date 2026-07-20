import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/DownloadOutlined'
import { downloadAvailableCabinsPdf, useListAvailableCabinsQuery } from './roomsCabinsApi'
import { extractErrorMessage } from '@/shared/crud/useCrudSnackbar'

interface AvailableCabinsDialogProps {
  open: boolean
  libraryId: string
  onClose: () => void
}

export function AvailableCabinsDialog({ open, libraryId, onClose }: AvailableCabinsDialogProps) {
  const { data: groups, isLoading } = useListAvailableCabinsQuery(libraryId, { skip: !open })
  const [isDownloading, setIsDownloading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  async function handleDownloadPdf() {
    setServerError(null)
    setIsDownloading(true)
    try {
      await downloadAvailableCabinsPdf(libraryId)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    } finally {
      setIsDownloading(false)
    }
  }

  const totalAvailable = groups?.reduce((sum, g) => sum + g.cabins.length, 0) ?? 0

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Available cabins
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {isLoading && <Typography color="text.secondary">Loading available cabins…</Typography>}

          {!isLoading && groups?.length === 0 && <Alert severity="info">No cabins are currently available.</Alert>}

          {!isLoading && groups && groups.length > 0 && (
            <>
              <Typography variant="body2" color="text.secondary">
                {totalAvailable} cabin{totalAvailable === 1 ? '' : 's'} available across {groups.length} categor
                {groups.length === 1 ? 'y' : 'ies'}.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {groups.map((group) => (
                  <Box key={group.category_name} sx={{ flex: '1 1 150px', minWidth: 150 }}>
                    <Box
                      sx={{
                        bgcolor: group.color_code ?? 'grey.700',
                        color: 'common.white',
                        px: 1,
                        py: 0.75,
                        borderRadius: 1,
                        mb: 1,
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="subtitle2" noWrap>
                        {group.category_name}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85 }}>
                        {group.is_ac ? 'AC' : 'Non-AC'} · {group.cabins.length} available
                      </Typography>
                    </Box>
                    <Stack spacing={0.5}>
                      {group.cabins.map((cabin, idx) => (
                        <Box
                          key={cabin.cabin_number}
                          sx={{
                            textAlign: 'center',
                            py: 0.5,
                            borderRadius: 0.5,
                            bgcolor: idx % 2 === 0 ? 'grey.50' : 'background.paper',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="body2">{cabin.cabin_number}</Typography>
                        </Box>
                      ))}
                    </Stack>
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
          disabled={isDownloading || isLoading || totalAvailable === 0}
        >
          Download PDF
        </Button>
      </DialogActions>
    </Dialog>
  )
}
