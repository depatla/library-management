import { useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {
  useActivateLibraryMutation,
  useCreateLibraryMutation,
  useDeactivateLibraryMutation,
  useGetAllLibrariesQuery,
} from './librariesApi'
import { useLogoutMutation } from '@/features/auth/authApi'
import { useAppDispatch } from '@/app/hooks'
import { sessionCleared } from '@/features/auth/authSlice'
import { useNavigate } from 'react-router-dom'

const emptyForm = {
  name: '',
  city: '',
  ownerFullName: '',
  ownerEmail: '',
  ownerPassword: '',
}

export function AdminConsolePage() {
  const { data: libraries, isLoading } = useGetAllLibrariesQuery()
  const [createLibrary, { isLoading: isCreating, error: createError }] = useCreateLibraryMutation()
  const [activateLibrary] = useActivateLibraryMutation()
  const [deactivateLibrary] = useDeactivateLibraryMutation()
  const [logout] = useLogoutMutation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    const result = await createLibrary({
      name: form.name,
      city: form.city || undefined,
      owner: {
        full_name: form.ownerFullName,
        email: form.ownerEmail,
        password: form.ownerPassword,
      },
    })
      .unwrap()
      .catch(() => null)
    if (result) {
      setDialogOpen(false)
      setForm(emptyForm)
    }
  }

  async function handleLogout() {
    await logout().catch(() => null)
    dispatch(sessionCleared())
    navigate('/login', { replace: true })
  }

  return (
    <Box sx={{ p: 4, maxWidth: 1000, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Platform Admin
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create and manage libraries
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={() => setDialogOpen(true)}>
            New library
          </Button>
          <Button variant="outlined" onClick={handleLogout}>
            Sign out
          </Button>
        </Stack>
      </Stack>

      {!isLoading && (
        <Grid container spacing={2}>
          {libraries?.map((lib) => (
            <Grid key={lib.id} size={{ xs: 12, sm: 6 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {lib.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Owner: {lib.owner_name}
                    </Typography>
                    <Chip
                      sx={{ mt: 1 }}
                      size="small"
                      label={lib.status}
                      color={lib.status === 'active' ? 'success' : lib.status === 'suspended' ? 'error' : 'default'}
                    />
                  </Box>
                  <Stack alignItems="center">
                    <Switch
                      checked={lib.status === 'active'}
                      onChange={(_, checked) =>
                        checked ? activateLibrary(lib.id) : deactivateLibrary(lib.id)
                      }
                    />
                    <Typography variant="caption">{lib.status === 'active' ? 'Active' : 'Inactive'}</Typography>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <Box component="form" onSubmit={handleCreate}>
          <DialogTitle>Create library</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {createError && <Alert severity="error">Could not create library. Check the details and try again.</Alert>}
              <TextField
                label="Library name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="City"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                fullWidth
              />
              <Typography variant="subtitle2" sx={{ pt: 1 }}>
                Library owner
              </Typography>
              <TextField
                label="Owner full name"
                value={form.ownerFullName}
                onChange={(e) => setForm((f) => ({ ...f, ownerFullName: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Owner email"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Owner password"
                type="password"
                helperText="Minimum 8 characters — share this with the owner separately."
                value={form.ownerPassword}
                onChange={(e) => setForm((f) => ({ ...f, ownerPassword: e.target.value }))}
                required
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  )
}
