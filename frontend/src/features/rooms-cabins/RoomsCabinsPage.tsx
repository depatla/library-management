import { useState } from 'react'
import { Box, Tab, Tabs } from '@mui/material'
import { RoomCategoriesTab } from './RoomCategoriesTab'
import { CabinsTab } from './CabinsTab'
import { useParams } from 'react-router-dom'

export function RoomsCabinsPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Room Categories" />
          <Tab label="Cabins" />
        </Tabs>
      </Box>
      {tab === 0 && <RoomCategoriesTab libraryId={libraryId!} />}
      {tab === 1 && <CabinsTab libraryId={libraryId!} />}
    </Box>
  )
}
