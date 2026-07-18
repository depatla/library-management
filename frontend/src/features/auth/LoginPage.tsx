import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAppDispatch } from '@/app/hooks'
import { credentialsReceived } from './authSlice'
import { useLoginMutation } from './authApi'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login, { isLoading, error }] = useLoginMutation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = await login({ email, password }).unwrap().catch(() => null)
    if (!result) return

    dispatch(credentialsReceived({ user: result.user, accessToken: result.access_token }))

    if (result.user.is_super_admin) {
      navigate('/admin', { replace: true })
    } else if (result.user.memberships.length === 1) {
      navigate(`/libraries/${result.user.memberships[0].library_id}`, { replace: true })
    } else {
      navigate('/libraries', { replace: true })
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper variant="outlined" sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Study Library Management
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Sign in to continue
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Stack spacing={2}>
            {error && <Alert severity="error">Invalid email or password.</Alert>}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={isLoading} fullWidth>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}
