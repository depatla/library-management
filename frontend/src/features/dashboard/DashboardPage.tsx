import { Alert, Box, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { useGetDbHealthQuery } from './dashboardApi'

export function DashboardPage() {
  const { data, error, isLoading } = useGetDbHealthQuery()

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Study Library Management System
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Module 4 scaffold — verifying Frontend → FastAPI → PostgreSQL connectivity.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mt: 3, maxWidth: 480 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Backend / Database connection</Typography>

          {isLoading && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={20} />
              <Typography>Checking connection…</Typography>
            </Stack>
          )}

          {error && (
            <Alert severity="error">
              Could not reach the backend at <code>http://localhost:8000</code>. Make sure the FastAPI
              server is running (see docs/RUN_LOCALLY.md).
            </Alert>
          )}

          {data && (
            <>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label="Connected" color="success" size="small" />
                <Typography variant="body2">PostgreSQL is reachable</Typography>
              </Stack>
              <Typography variant="body2">
                Tables in schema: <strong>{data.table_count}</strong>
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                {data.postgres_version}
              </Typography>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}
