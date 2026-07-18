import { createTheme } from '@mui/material/styles'

export function buildTheme(mode: 'light' | 'dark', primaryColor: string, secondaryColor: string) {
  return createTheme({
    palette: {
      mode,
      primary: { main: primaryColor },
      secondary: { main: secondaryColor },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: ['Inter', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
    },
  })
}
