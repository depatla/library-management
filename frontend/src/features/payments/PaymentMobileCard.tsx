import { Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import type { Payment } from './paymentsApi'

interface PaymentMobileCardProps {
  payment: Payment
  onView: () => void
  onDelete: () => void
}

export function PaymentMobileCard({ payment, onView, onDelete }: PaymentMobileCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {payment.student_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {payment.period_start} → {payment.period_end}
          </Typography>
        </Stack>
        <Typography variant="subtitle2" fontWeight={700}>
          ₹{payment.amount}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: 'wrap' }}>
        <Chip size="small" label={payment.frequency} />
        <Chip size="small" label={payment.payment_method} />

        <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
          <Tooltip title="View details">
            <IconButton size="small" onClick={onView}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" color="error" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  )
}
