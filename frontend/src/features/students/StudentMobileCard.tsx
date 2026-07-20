import { alpha } from '@mui/material/styles'
import { Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined'
import dayjs from 'dayjs'
import type { Student } from './studentsApi'

const statusColors: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
  active: 'success',
  inactive: 'default',
  expired: 'error',
  suspended: 'warning',
}

interface StudentMobileCardProps {
  student: Student
  onAssignCabin: () => void
  onRemoveCabin: () => void
  onAssignLocker: () => void
  onRemoveLocker: () => void
  onRecordPayment: () => void
  onEdit: () => void
  onDelete: () => void
}

export function StudentMobileCard({
  student,
  onAssignCabin,
  onRemoveCabin,
  onAssignLocker,
  onRemoveLocker,
  onRecordPayment,
  onEdit,
  onDelete,
}: StudentMobileCardProps) {
  const isExpired = Boolean(student.expiry_date) && dayjs(student.expiry_date).isBefore(dayjs(), 'day')

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: isExpired ? (theme) => alpha(theme.palette.error.main, 0.08) : 'background.paper',
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {student.full_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {student.phone}
          </Typography>
        </Stack>
        <Chip size="small" label={student.status} color={statusColors[student.status] ?? 'default'} />
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        Expires: {student.expiry_date ?? 'No payments yet'}
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: 'wrap' }}>
        {student.cabin_number ? (
          <Chip
            size="small"
            label={student.room_category_name ? `${student.room_category_name} - ${student.cabin_number}` : student.cabin_number}
            onDelete={onRemoveCabin}
          />
        ) : (
          <Tooltip title="Assign cabin">
            <IconButton size="small" onClick={onAssignCabin}>
              <MeetingRoomOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {student.locker_number ? (
          <Chip size="small" label={student.locker_number} onDelete={onRemoveLocker} />
        ) : (
          <Tooltip title="Assign locker">
            <IconButton size="small" onClick={onAssignLocker}>
              <LockOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Stack direction="row" spacing={0.5} sx={{ ml: 'auto' }}>
          <Tooltip title="Record payment">
            <IconButton size="small" onClick={onRecordPayment}>
              <PaymentOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
