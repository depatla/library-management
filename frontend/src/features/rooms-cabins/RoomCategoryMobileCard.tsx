import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import AcUnitIcon from '@mui/icons-material/AcUnitOutlined'
import WhatshotIcon from '@mui/icons-material/WhatshotOutlined'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import type { RoomCategory } from './roomsCabinsApi'

interface RoomCategoryMobileCardProps {
  category: RoomCategory
  onToggleAc: () => void
  onEdit: () => void
  onDelete: () => void
}

export function RoomCategoryMobileCard({ category, onToggleAc, onEdit, onDelete }: RoomCategoryMobileCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box
          sx={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: category.color_code ?? 'grey.400',
            border: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle2" noWrap>
              {category.name}
            </Typography>
            {category.is_default && <Chip size="small" label="Default" />}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Order {category.display_order}
          </Typography>
        </Box>
        <Tooltip title={category.is_ac_locked ? 'Locked while cabins are occupied' : 'Toggle AC / Non-AC'}>
          <span>
            <IconButton size="small" disabled={category.is_ac_locked} onClick={onToggleAc}>
              {category.is_ac ? <AcUnitIcon fontSize="small" color="info" /> : <WhatshotIcon fontSize="small" color="warning" />}
            </IconButton>
          </span>
        </Tooltip>
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
