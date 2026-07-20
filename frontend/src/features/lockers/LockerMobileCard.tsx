import { Chip, IconButton, Paper, Stack, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import type { Locker } from './lockersApi'

const statusColors: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
  available: 'success',
  occupied: 'default',
  reserved: 'warning',
  maintenance: 'error',
}

interface LockerMobileCardProps {
  locker: Locker
  onEdit: () => void
  onDelete: () => void
}

export function LockerMobileCard({ locker, onEdit, onDelete }: LockerMobileCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            Locker {locker.locker_number}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            ₹{locker.monthly_rent} / month
          </Typography>
        </Stack>
        <Chip size="small" label={locker.status} color={statusColors[locker.status] ?? 'default'} />
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
