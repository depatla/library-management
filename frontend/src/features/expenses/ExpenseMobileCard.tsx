import { IconButton, Paper, Stack, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import type { Expense } from './expensesApi'

interface ExpenseMobileCardProps {
  expense: Expense
  onEdit: () => void
  onDelete: () => void
}

export function ExpenseMobileCard({ expense, onEdit, onDelete }: ExpenseMobileCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {expense.category_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {expense.expense_date}
            {expense.paid_to ? ` · ${expense.paid_to}` : ''}
          </Typography>
        </Stack>
        <Typography variant="subtitle2" fontWeight={700}>
          ₹{expense.amount}
        </Typography>
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary" noWrap>
          {expense.recorded_by_name ? `Recorded by ${expense.recorded_by_name}` : ''}
        </Typography>
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
