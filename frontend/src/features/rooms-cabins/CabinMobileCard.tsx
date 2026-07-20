import { Chip, IconButton, Paper, Stack, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import type { Cabin } from './roomsCabinsApi'

const statusColors: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
  available: 'success',
  occupied: 'default',
  reserved: 'warning',
  maintenance: 'error',
}

interface CabinMobileCardProps {
  cabin: Cabin
  onEdit: () => void
  onDelete: () => void
}

export function CabinMobileCard({ cabin, onEdit, onDelete }: CabinMobileCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            Cabin {cabin.cabin_number}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {cabin.room_category_name} · Capacity {cabin.capacity}
          </Typography>
        </Stack>
        <Chip size="small" label={cabin.status} color={statusColors[cabin.status] ?? 'default'} />
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" color="error" onClick={onDelete}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  )
}
