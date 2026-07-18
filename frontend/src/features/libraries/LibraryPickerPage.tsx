import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import { useGetMyLibrariesQuery } from './librariesApi'

export function LibraryPickerPage() {
  const { data: libraries, isLoading } = useGetMyLibrariesQuery()

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 4, maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Choose a library
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        You belong to more than one library. Select one to continue.
      </Typography>

      <Stack spacing={2} sx={{ mt: 3 }}>
        {libraries?.map((lib) => (
          <Card key={lib.id} variant="outlined">
            <CardActionArea component={RouterLink} to={`/libraries/${lib.id}`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6">{lib.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {lib.city ?? 'No city set'}
                    </Typography>
                  </Box>
                  <Chip
                    label={lib.status}
                    size="small"
                    color={lib.status === 'active' ? 'success' : 'default'}
                  />
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Box>
  )
}
