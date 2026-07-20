import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { z } from 'zod'
import dayjs from 'dayjs'
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { ConfirmDialog } from '@/shared/crud/ConfirmDialog'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import { useListPaymentsQuery, useCreatePaymentMutation, useDeletePaymentMutation, type Payment } from './paymentsApi'
import { useListStudentsQuery } from '@/features/students/studentsApi'
import { PaymentMobileCard } from './PaymentMobileCard'

const createSchema = z
  .object({
    student_id: z.string().min(1, 'Student is required'),
    amount: z.number().positive('Must be greater than 0'),
    frequency: z.string().min(1, 'Frequency is required'),
    period_start: z.string().min(1, 'Start date is required'),
    period_end: z.string().optional(),
    number_of_months: z.number().optional(),
    payment_method: z.string().min(1, 'Payment method is required'),
    transaction_reference: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.frequency === 'daily' && !values.period_end) {
      ctx.addIssue({ code: 'custom', message: 'End date is required', path: ['period_end'] })
    }
    if (values.frequency === 'monthly' && !values.number_of_months) {
      ctx.addIssue({ code: 'custom', message: 'Number of months is required', path: ['number_of_months'] })
    } else if (values.frequency === 'monthly' && (values.number_of_months! < 1 || values.number_of_months! > 6)) {
      ctx.addIssue({ code: 'custom', message: 'Must be between 1 and 6', path: ['number_of_months'] })
    }
  })

type CreateForm = z.infer<typeof createSchema>

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
]

function computeMonthlyEndDate(values: Record<string, unknown>): string {
  const start = values.period_start as string | undefined
  const months = Number(values.number_of_months)
  if (!start || !months) return ''
  const end = dayjs(start).add(months, 'month')
  return end.isValid() ? end.format('YYYY-MM-DD') : ''
}

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

function currentMonthRange() {
  const start = dayjs().startOf('month').format('YYYY-MM-DD')
  const end = dayjs().endOf('month').format('YYYY-MM-DD')
  return { dateFrom: start, dateTo: end }
}

export function PaymentsPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
  const [search, setSearch] = useState('')
  const [{ dateFrom, dateTo }, setDateRange] = useState(currentMonthRange)
  const { data, isLoading } = useListPaymentsQuery({
    libraryId: libraryId!,
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })
  const { data: studentsPage } = useListStudentsQuery({ libraryId: libraryId!, page: 1, pageSize: 100 })
  const [createPayment, { isLoading: isCreating }] = useCreatePaymentMutation()
  const [deletePayment] = useDeletePaymentMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Payment | null>(null)
  const [viewing, setViewing] = useState<Payment | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const isCurrentMonth = JSON.stringify(currentMonthRange()) === JSON.stringify({ dateFrom, dateTo })

  const studentOptions = (studentsPage?.items ?? []).map((s) => ({ value: s.id, label: s.full_name }))

  const createFields: CrudField[] = [
    { name: 'student_id', label: 'Student', type: 'select', options: studentOptions, required: true },
    { name: 'amount', label: 'Amount (₹)', type: 'decimal', required: true },
    { name: 'frequency', label: 'Frequency', type: 'select', options: FREQUENCY_OPTIONS, required: true },
    { name: 'period_start', label: 'From date', type: 'date', required: true },
    { name: 'period_end', label: 'To date', type: 'date', required: true, visible: (v) => v.frequency === 'daily' },
    {
      name: 'number_of_months',
      label: 'Number of months',
      type: 'number',
      required: true,
      helperText: 'Up to 6 months, one payment per month',
      visible: (v) => v.frequency === 'monthly',
    },
    {
      name: 'computed_to_date',
      label: 'To date (auto-calculated)',
      type: 'display',
      compute: computeMonthlyEndDate,
      visible: (v) => v.frequency === 'monthly',
    },
    { name: 'payment_method', label: 'Payment method', type: 'select', options: METHOD_OPTIONS, required: true },
    { name: 'transaction_reference', label: 'Transaction reference', type: 'text' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ]

  const columns: GridColDef<Payment>[] = [
    { field: 'student_name', headerName: 'Student', flex: 1, minWidth: 150 },
    { field: 'amount', headerName: 'Amount', width: 110, valueFormatter: (v: number) => `₹${v}` },
    { field: 'frequency', headerName: 'Frequency', width: 110 },
    { field: 'payment_method', headerName: 'Method', width: 120, renderCell: (params) => <Chip size="small" label={params.value} /> },
    { field: 'period_start', headerName: 'Month from', width: 110 },
    { field: 'period_end', headerName: 'Month to', width: 110 },
    { field: 'collected_by_name', headerName: 'Collected by', width: 140, valueGetter: (v) => v ?? '—' },
  ]

  async function handleCreate(values: CreateForm) {
    try {
      const { period_end, number_of_months, ...rest } = values
      await createPayment({
        libraryId: libraryId!,
        body: {
          ...rest,
          period_end: values.frequency === 'daily' ? period_end || null : null,
          number_of_months: values.frequency === 'monthly' ? number_of_months : null,
          transaction_reference: values.transaction_reference || null,
          notes: values.notes || null,
        },
      }).unwrap()
      notify('Payment recorded')
      setDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deletePayment({ libraryId: libraryId!, paymentId: deleting.id }).unwrap()
      notify('Payment deleted')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <CrudListPage
        title="Payments"
        subtitle="Collect payments with automatic monthly proration"
        columns={columns}
        rows={data?.items ?? []}
        rowCount={data?.total ?? 0}
        loading={isLoading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        onAdd={() => {
          setServerError(null)
          setDialogOpen(true)
        }}
        addLabel="Record payment"
        onView={(row) => setViewing(row)}
        onDelete={(row) => setDeleting(row)}
        renderMobileCard={(payment) => (
          <PaymentMobileCard payment={payment} onView={() => setViewing(payment)} onDelete={() => setDeleting(payment)} />
        )}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by student name…"
        extraToolbar={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ width: '100%' }}>
            <TextField
              size="small"
              label="From date"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateRange({ dateFrom: e.target.value, dateTo })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              label="To date"
              type="date"
              value={dateTo}
              onChange={(e) => setDateRange({ dateFrom, dateTo: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button size="small" variant={isCurrentMonth ? 'contained' : 'outlined'} onClick={() => setDateRange(currentMonthRange())}>
              Current month
            </Button>
          </Stack>
        }
      />

      <CrudFormDialog<CreateForm>
        open={dialogOpen}
        title="Record payment"
        fields={createFields}
        schema={createSchema}
        defaultValues={{
          student_id: '',
          amount: 0,
          frequency: 'monthly',
          period_start: '',
          period_end: '',
          number_of_months: 1,
          payment_method: 'cash',
          transaction_reference: '',
          notes: '',
        }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        serverError={serverError}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete payment"
        message={`Delete this payment of ₹${deleting?.amount} for "${deleting?.student_name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Payment details
          <IconButton size="small" onClick={() => setViewing(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewing && (
            <Stack spacing={1.5}>
              <DetailRow label="Student" value={viewing.student_name} />
              <DetailRow label="Amount" value={`₹${viewing.amount}`} />
              <DetailRow label="Frequency" value={viewing.frequency} />
              <DetailRow label="Payment method" value={<Chip size="small" label={viewing.payment_method} />} />
              <DetailRow label="Month from" value={viewing.period_start} />
              <DetailRow label="Month to" value={viewing.period_end} />
              <DetailRow label="Transaction reference" value={viewing.transaction_reference || '—'} />
              <DetailRow label="Notes" value={viewing.notes || '—'} />
              <DetailRow label="Collected by" value={viewing.collected_by_name ?? '—'} />
              <DetailRow label="Paid at" value={dayjs(viewing.paid_at).format('YYYY-MM-DD HH:mm')} />
              {viewing.allocations.length > 0 && (
                <>
                  <Divider />
                  <Typography variant="subtitle2">Monthly allocations</Typography>
                  {viewing.allocations.map((a) => (
                    <DetailRow
                      key={a.period_month}
                      label={a.period_month}
                      value={`₹${a.allocated_amount}${a.is_prorated ? ' (prorated)' : ''}`}
                    />
                  ))}
                </>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {SnackbarElement}
    </>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} sx={{ textAlign: 'right' }}>
        {value}
      </Typography>
    </Stack>
  )
}
