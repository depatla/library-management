import { useState } from 'react'
import { z } from 'zod'
import { Box, Paper, Skeleton, Stack, Switch, Typography, FormControlLabel } from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TextField, Button, Alert } from '@mui/material'
import { useGetWhatsappConfigQuery, useUpsertWhatsappConfigMutation } from './whatsappApi'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'

const configSchema = z.object({
  account_sid: z.string().min(1, 'Account SID is required'),
  auth_token: z.string().min(1, 'Auth token is required'),
  whatsapp_number: z.string().min(1, 'WhatsApp number is required').max(20),
  is_active: z.boolean(),
})

type ConfigForm = z.infer<typeof configSchema>

export function ConfigTab({ libraryId }: { libraryId: string }) {
  const { data: config, isLoading } = useGetWhatsappConfigQuery(libraryId)
  const [upsertConfig, { isLoading: isSaving }] = useUpsertWhatsappConfigMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()
  const [serverError, setServerError] = useState<string | null>(null)

  const { control, handleSubmit } = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    values: {
      account_sid: config?.account_sid ?? '',
      auth_token: '',
      whatsapp_number: config?.whatsapp_number ?? '',
      is_active: config?.is_active ?? true,
    },
  })

  async function onSubmit(values: ConfigForm) {
    try {
      await upsertConfig({ libraryId, body: values }).unwrap()
      notify('Twilio configuration saved')
      setServerError(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Skeleton variant="rounded" height={320} />
      </Box>
    )
  }

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 520 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Twilio WhatsApp configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Credentials from your Twilio console. The auth token is stored securely and never shown again after saving.
        </Typography>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2.5}>
              {serverError && <Alert severity="error">{serverError}</Alert>}
              {config && (
                <Alert severity="info">
                  Current token: <strong>{config.auth_token_masked}</strong> — leave blank below to keep it unchanged is not supported by the
                  API; re-enter the token to update.
                </Alert>
              )}
              <Controller
                name="account_sid"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField {...field} label="Account SID" fullWidth error={Boolean(fieldState.error)} helperText={fieldState.error?.message} />
                )}
              />
              <Controller
                name="auth_token"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Auth token"
                    type="password"
                    fullWidth
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="whatsapp_number"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="WhatsApp number"
                    placeholder="+14155238886"
                    fullWidth
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <FormControlLabel control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label="Active" />
                )}
              />
              <Button type="submit" variant="contained" disabled={isSaving}>
                Save configuration
              </Button>
            </Stack>
          </form>
        </Paper>
      </Box>
      {SnackbarElement}
    </>
  )
}
