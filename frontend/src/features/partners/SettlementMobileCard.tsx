import { Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import type { Settlement } from './partnersApi'

interface SettlementMobileCardProps {
  settlement: Settlement
  onRecordReceipt: () => void
}

export function SettlementMobileCard({ settlement, onRecordReceipt }: SettlementMobileCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {settlement.period_month}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            Share ₹{settlement.share_amount} · Received ₹{settlement.received_amount}
          </Typography>
        </Stack>
        <Chip size="small" label={settlement.settled_at ? 'Settled' : 'Pending'} color={settlement.settled_at ? 'success' : 'warning'} />
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          Balance: ₹{settlement.balance}
        </Typography>
        <Tooltip title="Record receipt">
          <IconButton size="small" onClick={onRecordReceipt}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  )
}
