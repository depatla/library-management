import { useState } from 'react'
import { Box, Button, Stack, Tab, Tabs } from '@mui/material'
import EventSeatIcon from '@mui/icons-material/EventSeatOutlined'
import { RoomCategoriesTab } from './RoomCategoriesTab'
import { CabinsTab } from './CabinsTab'
import { AvailableCabinsDialog } from './AvailableCabinsDialog'
import { useParams } from 'react-router-dom'

export function RoomsCabinsPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [tab, setTab] = useState(0)
  const [availableOpen, setAvailableOpen] = useState(false)

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{
          px: { xs: 2, md: 3 },
          pt: { xs: 2, md: 3 },
          pb: { xs: 1.5, sm: 0 },
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          <Tab label="Room Categories" />
          <Tab label="Cabins" />
        </Tabs>
        <Button
          variant="outlined"
          startIcon={<EventSeatIcon />}
          onClick={() => setAvailableOpen(true)}
          sx={{ mb: { xs: 0, sm: 1 }, alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          Available cabins
        </Button>
      </Stack>
      {tab === 0 && <RoomCategoriesTab libraryId={libraryId!} />}
      {tab === 1 && <CabinsTab libraryId={libraryId!} />}
      <AvailableCabinsDialog open={availableOpen} libraryId={libraryId!} onClose={() => setAvailableOpen(false)} />
    </Box>
  )
}
