import { useState, useCallback } from 'react'
import { Snackbar, Alert } from '@mui/material'

interface SnackbarState {
  open: boolean
  message: string
  severity: 'success' | 'error'
}

export function useCrudSnackbar() {
  const [state, setState] = useState<SnackbarState>({ open: false, message: '', severity: 'success' })

  const notify = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setState({ open: true, message, severity })
  }, [])

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  const element = (
    <Snackbar open={state.open} autoHideDuration={4000} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity={state.severity} onClose={close} variant="filled" sx={{ width: '100%' }}>
        {state.message}
      </Alert>
    </Snackbar>
  )

  return { notify, SnackbarElement: element }
}

export function extractErrorMessage(err: unknown): string {
  const maybe = err as { data?: { detail?: string } } | undefined
  return maybe?.data?.detail ?? 'Something went wrong. Please try again.'
}
