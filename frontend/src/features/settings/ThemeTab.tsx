import { useState } from 'react'
import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useOutletContext } from 'react-router-dom'
import { useUpdateLibraryThemeMutation, type Library } from '@/features/libraries/librariesApi'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'

export function ThemeTab({ libraryId }: { libraryId: string }) {
  const { library } = useOutletContext<{ library: Library }>()
  const [updateTheme, { isLoading }] = useUpdateLibraryThemeMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [primaryColor, setPrimaryColor] = useState(library.primary_color)
  const [secondaryColor, setSecondaryColor] = useState(library.secondary_color)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(library.theme_mode)

  async function handleSave() {
    try {
      await updateTheme({ libraryId, body: { primary_color: primaryColor, secondary_color: secondaryColor, theme_mode: themeMode } }).unwrap()
      notify('Theme updated')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    }
  }

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 480 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Library theme
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Customize the primary and secondary colors used across this library's dashboard
        </Typography>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Primary color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              sx={{ '& input': { height: 40 } }}
            />
            <TextField
              label="Secondary color"
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              sx={{ '& input': { height: 40 } }}
            />
            <TextField select label="Theme mode" value={themeMode} onChange={(e) => setThemeMode(e.target.value as 'light' | 'dark')}>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </TextField>
            <Button variant="contained" onClick={handleSave} disabled={isLoading}>
              Save theme
            </Button>
          </Stack>
        </Paper>
      </Box>
      {SnackbarElement}
    </>
  )
}
