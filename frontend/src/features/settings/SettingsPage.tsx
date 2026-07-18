import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Tab, Tabs } from '@mui/material'
import { StaffTab } from './StaffTab'
import { ThemeTab } from './ThemeTab'

export function SettingsPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Staff" />
          <Tab label="Theme" />
        </Tabs>
      </Box>
      {tab === 0 && <StaffTab libraryId={libraryId!} />}
      {tab === 1 && <ThemeTab libraryId={libraryId!} />}
    </Box>
  )
}
