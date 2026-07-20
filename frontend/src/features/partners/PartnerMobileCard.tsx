import { Button, Chip, IconButton, Paper, Stack, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import type { Partner } from './partnersApi'

interface PartnerMobileCardProps {
  partner: Partner
  onGrantLogin: () => void
  onEdit: () => void
  onDelete: () => void
}

export function PartnerMobileCard({ partner, onGrantLogin, onEdit, onDelete }: PartnerMobileCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {partner.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {partner.phone ?? 'No phone'} · {partner.share_percentage}% share
          </Typography>
        </Stack>
        <Chip size="small" label={partner.is_active ? 'Active' : 'Inactive'} color={partner.is_active ? 'success' : 'default'} />
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
        {partner.email ? (
          <Typography variant="caption" color="text.secondary" noWrap>
            {partner.email}
          </Typography>
        ) : (
          <Button size="small" onClick={onGrantLogin}>
            Grant login
          </Button>
        )}
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  )
}
