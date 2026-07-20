import { useMediaQuery, type Theme } from '@mui/material'

/** True on phone-sized viewports (<600px), where a data grid is unusable and card layouts read better. */
export function useIsMobile(): boolean {
  return useMediaQuery((t: Theme) => t.breakpoints.down('sm'))
}
