import { useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/DownloadOutlined'
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined'
import { downloadStudentSampleCsv, useBulkUploadStudentsMutation, type StudentBulkUploadResult } from './studentsApi'
import { extractErrorMessage } from '@/shared/crud/useCrudSnackbar'

interface StudentBulkUploadDialogProps {
  open: boolean
  libraryId: string
  onClose: () => void
}

export function StudentBulkUploadDialog({ open, libraryId, onClose }: StudentBulkUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<StudentBulkUploadResult | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [bulkUploadStudents, { isLoading: isUploading }] = useBulkUploadStudentsMutation()

  function reset() {
    setFile(null)
    setResult(null)
    setServerError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleDownloadSample() {
    setIsDownloading(true)
    try {
      await downloadStudentSampleCsv(libraryId)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleUpload() {
    if (!file) return
    setServerError(null)
    try {
      const uploadResult = await bulkUploadStudents({ libraryId, file }).unwrap()
      setResult(uploadResult)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Bulk upload students
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Download the sample CSV, fill in a row per student (name, mobile, email — optional, and gender), then
            upload it here. Mobile numbers must be unique across the whole library.
          </Typography>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadSample}
            disabled={isDownloading}
            sx={{ alignSelf: 'flex-start' }}
          >
            Download sample CSV
          </Button>

          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadFileIcon />}
            sx={{ alignSelf: 'flex-start' }}
          >
            {file ? file.name : 'Choose CSV file'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              hidden
              onChange={(e) => {
                setResult(null)
                setServerError(null)
                setFile(e.target.files?.[0] ?? null)
              }}
            />
          </Button>

          {serverError && <Alert severity="error">{serverError}</Alert>}

          {result && (
            <Box>
              <Alert severity={result.error_count > 0 ? 'warning' : 'success'} sx={{ mb: 1 }}>
                {result.created_count} student{result.created_count === 1 ? '' : 's'} created
                {result.error_count > 0 ? `, ${result.error_count} row${result.error_count === 1 ? '' : 's'} skipped` : ''}.
              </Alert>
              {result.errors.length > 0 && (
                <List dense sx={{ maxHeight: 240, overflowY: 'auto', bgcolor: 'action.hover', borderRadius: 1 }}>
                  {result.errors.map((rowError) => (
                    <ListItem key={rowError.row_number}>
                      <ListItemText
                        primary={`Row ${rowError.row_number}${rowError.name ? ` (${rowError.name})` : ''}`}
                        secondary={rowError.error}
                      />
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
        <Button variant="contained" onClick={handleUpload} disabled={!file || isUploading}>
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  )
}
