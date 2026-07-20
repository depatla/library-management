import type { ReactElement } from 'react'
import { Button, IconButton, Tooltip } from '@mui/material'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

interface ResponsiveToolbarButtonProps {
  icon: ReactElement
  label: string
  onClick: () => void
}

/** Full text+icon button on desktop; collapses to a tooltipped icon-only button on phone-sized viewports so toolbar rows don't wrap unevenly. */
export function ResponsiveToolbarButton({ icon, label, onClick }: ResponsiveToolbarButtonProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Tooltip title={label}>
        <IconButton onClick={onClick} sx={{ border: 1, borderColor: 'divider' }}>
          {icon}
        </IconButton>
      </Tooltip>
    )
  }

  return (
    <Button variant="outlined" startIcon={icon} onClick={onClick}>
      {label}
    </Button>
  )
}
