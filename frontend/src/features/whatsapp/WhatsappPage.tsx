import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Tab, Tabs } from '@mui/material'
import { ConfigTab } from './ConfigTab'
import { TemplatesTab } from './TemplatesTab'
import { MessagesTab } from './MessagesTab'

export function WhatsappPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Twilio Config" />
          <Tab label="Templates" />
          <Tab label="Messages" />
        </Tabs>
      </Box>
      {tab === 0 && <ConfigTab libraryId={libraryId!} />}
      {tab === 1 && <TemplatesTab libraryId={libraryId!} />}
      {tab === 2 && <MessagesTab libraryId={libraryId!} />}
    </Box>
  )
}
