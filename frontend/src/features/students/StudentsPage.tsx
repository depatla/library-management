import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { z } from 'zod'
import dayjs from 'dayjs'
import { Chip, IconButton, Tooltip } from '@mui/material'
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { ConfirmDialog } from '@/shared/crud/ConfirmDialog'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import {
  useListStudentsQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useAssignCabinMutation,
  useAssignLockerMutation,
  type Student,
} from './studentsApi'
import { useListLockersQuery } from '@/features/lockers/lockersApi'
import { useListCabinsQuery } from '@/features/rooms-cabins/roomsCabinsApi'
import { useCreatePaymentMutation } from '@/features/payments/paymentsApi'
import { useSendWhatsappMessageMutation } from '@/features/whatsapp/whatsappApi'

const statusColors: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
  active: 'success',
  inactive: 'default',
  expired: 'error',
  suspended: 'warning',
}

const createSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(150),
  phone: z.string().min(1, 'Phone is required').max(20),
  email: z.string().optional(),
  gender: z.string().optional(),
})

const updateSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(150),
  phone: z.string().min(1, 'Phone is required').max(20),
  email: z.string().optional(),
  gender: z.string().optional(),
})

type CreateForm = z.infer<typeof createSchema>
type UpdateForm = z.infer<typeof updateSchema>

const baseFields: CrudField[] = [
  { name: 'full_name', label: 'Full name', type: 'text', required: true },
  { name: 'phone', label: 'Phone', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'text' },
  {
    name: 'gender',
    label: 'Gender',
    type: 'select',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'other', label: 'Other' },
    ],
  },
]

const assignCabinSchema = z.object({
  cabin_id: z.string().min(1, 'Cabin is required'),
  send_welcome_message: z.boolean(),
})

type AssignCabinForm = z.infer<typeof assignCabinSchema>

const assignLockerSchema = z.object({
  locker_id: z.string().min(1, 'Locker is required'),
})

type AssignLockerForm = z.infer<typeof assignLockerSchema>

const recordPaymentSchema = z
  .object({
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

type RecordPaymentForm = z.infer<typeof recordPaymentSchema>

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
]

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

function computeMonthlyEndDate(values: Record<string, unknown>): string {
  const start = values.period_start as string | undefined
  const months = Number(values.number_of_months)
  if (!start || !months) return ''
  const end = dayjs(start).add(months, 'month')
  return end.isValid() ? end.format('YYYY-MM-DD') : ''
}

const recordPaymentFields: CrudField[] = [
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

export function StudentsPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 100 })
  const [search, setSearch] = useState('')
  const { data, isLoading } = useListStudentsQuery({
    libraryId: libraryId!,
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
    search: search || undefined,
  })
  const { data: activeStudents } = useListStudentsQuery({ libraryId: libraryId!, page: 1, pageSize: 1, status: 'active' })
  const { data: availableLockers } = useListLockersQuery({ libraryId: libraryId!, page: 1, pageSize: 100, status: 'available' })
  const [cabinSearch, setCabinSearch] = useState('')
  const { data: availableCabins } = useListCabinsQuery({ libraryId: libraryId!, page: 1, pageSize: 100, status: 'available', search: cabinSearch || undefined })
  const [createStudent, { isLoading: isCreating }] = useCreateStudentMutation()
  const [updateStudent, { isLoading: isUpdating }] = useUpdateStudentMutation()
  const [deleteStudent] = useDeleteStudentMutation()
  const [assignCabin, { isLoading: isAssigningCabin }] = useAssignCabinMutation()
  const [assignLocker, { isLoading: isAssigningLocker }] = useAssignLockerMutation()
  const [createPayment, { isLoading: isRecordingPayment }] = useCreatePaymentMutation()
  const [sendWhatsappMessage] = useSendWhatsappMessageMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [assigningCabinTo, setAssigningCabinTo] = useState<Student | null>(null)
  const [removingCabinFrom, setRemovingCabinFrom] = useState<Student | null>(null)
  const [assigningLockerTo, setAssigningLockerTo] = useState<Student | null>(null)
  const [removingLockerFrom, setRemovingLockerFrom] = useState<Student | null>(null)
  const [recordingPaymentFor, setRecordingPaymentFor] = useState<Student | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const cabinOptions = (availableCabins?.items ?? []).map((c) => ({ value: c.id, label: `${c.room_category_name} - ${c.cabin_number}` }))
  const lockerOptions = (availableLockers?.items ?? []).map((l) => ({ value: l.id, label: l.locker_number }))

  const assignCabinFields: CrudField[] = [
    { name: 'cabin_id', label: 'Cabin', type: 'autocomplete', options: cabinOptions, required: true, onSearchChange: setCabinSearch },
    { name: 'send_welcome_message', label: 'Send WhatsApp welcome message', type: 'boolean' },
  ]
  const assignLockerFields: CrudField[] = [{ name: 'locker_id', label: 'Locker', type: 'select', options: lockerOptions, required: true }]

  const columns: GridColDef<Student>[] = [
    { field: 'full_name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    {
      field: 'cabin_number',
      headerName: 'Cabin',
      width: 160,
      sortable: false,
      renderCell: (params) =>
        params.value ? (
          <Chip
            size="small"
            label={params.row.room_category_name ? `${params.row.room_category_name} - ${params.value}` : params.value}
            onDelete={() => setRemovingCabinFrom(params.row)}
          />
        ) : (
          <Tooltip title="Assign cabin">
            <IconButton
              size="small"
              onClick={() => {
                setServerError(null)
                setCabinSearch('')
                setAssigningCabinTo(params.row)
              }}
            >
              <MeetingRoomOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
    },
    {
      field: 'locker_number',
      headerName: 'Locker',
      width: 140,
      sortable: false,
      renderCell: (params) =>
        params.value ? (
          <Chip size="small" label={params.value} onDelete={() => setRemovingLockerFrom(params.row)} />
        ) : (
          <Tooltip title="Assign locker">
            <IconButton
              size="small"
              onClick={() => {
                setServerError(null)
                setAssigningLockerTo(params.row)
              }}
            >
              <LockOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
    },
    { field: 'expiry_date', headerName: 'Expires', width: 120, valueGetter: (v) => v ?? 'No payments yet' },
    { field: 'created_by_name', headerName: 'Created by', width: 140, valueGetter: (v) => v ?? '—' },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params) => <Chip size="small" label={params.value} color={statusColors[params.value] ?? 'default'} />,
    },
    {
      field: 'record_payment',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="Record payment">
          <IconButton
            size="small"
            onClick={() => {
              setServerError(null)
              setRecordingPaymentFor(params.row)
            }}
          >
            <PaymentOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ]

  async function handleCreate(values: CreateForm) {
    try {
      const newStudent = await createStudent({
        libraryId: libraryId!,
        body: { ...values, email: values.email || null, gender: values.gender || null },
      }).unwrap()
      notify('Student enrolled')
      setDialogOpen(false)
      setRecordingPaymentFor(newStudent)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleUpdate(values: UpdateForm) {
    if (!editing) return
    try {
      await updateStudent({
        libraryId: libraryId!,
        studentId: editing.id,
        body: { ...values, email: values.email || null, gender: values.gender || null },
      }).unwrap()
      notify('Student updated')
      setEditing(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteStudent({ libraryId: libraryId!, studentId: deleting.id }).unwrap()
      notify('Student deleted')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(null)
    }
  }

  async function handleAssignCabin(values: AssignCabinForm) {
    if (!assigningCabinTo) return
    try {
      await assignCabin({ libraryId: libraryId!, studentId: assigningCabinTo.id, cabinId: values.cabin_id }).unwrap()
      notify('Cabin assigned')
      setAssigningCabinTo(null)
      if (values.send_welcome_message) {
        try {
          await sendWhatsappMessage({ libraryId: libraryId!, studentId: assigningCabinTo.id, templateType: 'welcome' }).unwrap()
          notify('Welcome WhatsApp message sent')
        } catch (err) {
          notify(`Cabin assigned, but WhatsApp send failed: ${extractErrorMessage(err)}`, 'error')
        }
      }
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleRemoveCabin() {
    if (!removingCabinFrom) return
    try {
      await assignCabin({ libraryId: libraryId!, studentId: removingCabinFrom.id, cabinId: null }).unwrap()
      notify('Cabin released')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setRemovingCabinFrom(null)
    }
  }

  async function handleAssignLocker(values: AssignLockerForm) {
    if (!assigningLockerTo) return
    try {
      await assignLocker({ libraryId: libraryId!, studentId: assigningLockerTo.id, lockerId: values.locker_id }).unwrap()
      notify('Locker assigned')
      setAssigningLockerTo(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleRemoveLocker() {
    if (!removingLockerFrom) return
    try {
      await assignLocker({ libraryId: libraryId!, studentId: removingLockerFrom.id, lockerId: null }).unwrap()
      notify('Locker released')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setRemovingLockerFrom(null)
    }
  }

  async function handleRecordPayment(values: RecordPaymentForm) {
    if (!recordingPaymentFor) return
    try {
      const { period_end, number_of_months, ...rest } = values
      await createPayment({
        libraryId: libraryId!,
        body: {
          ...rest,
          student_id: recordingPaymentFor.id,
          period_end: values.frequency === 'daily' ? period_end || null : null,
          number_of_months: values.frequency === 'monthly' ? number_of_months : null,
          transaction_reference: values.transaction_reference || null,
          notes: values.notes || null,
        },
      }).unwrap()
      notify('Payment recorded')
      setRecordingPaymentFor(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  return (
    <>
      <CrudListPage
        title="Students"
        subtitle={`Enrollment, seat & locker assignment, status · ${activeStudents?.total ?? 0} active`}
        columns={columns}
        rows={data?.items ?? []}
        rowCount={data?.total ?? 0}
        loading={isLoading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[20, 50, 100]}
        highlightRowIf={(row) => Boolean(row.expiry_date) && dayjs(row.expiry_date).isBefore(dayjs(), 'day')}
        onAdd={() => {
          setServerError(null)
          setDialogOpen(true)
        }}
        addLabel="Enroll student"
        onEdit={(row) => {
          setServerError(null)
          setEditing(row)
        }}
        onDelete={(row) => setDeleting(row)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or phone…"
      />

      <CrudFormDialog<CreateForm>
        open={dialogOpen}
        title="Enroll student"
        fields={baseFields}
        schema={createSchema}
        defaultValues={{ full_name: '', phone: '', email: '', gender: '' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        serverError={serverError}
      />

      <CrudFormDialog<UpdateForm>
        open={Boolean(editing)}
        title="Edit student"
        fields={baseFields}
        schema={updateSchema}
        defaultValues={{
          full_name: editing?.full_name ?? '',
          phone: editing?.phone ?? '',
          email: editing?.email ?? '',
          gender: editing?.gender ?? '',
        }}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        serverError={serverError}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete student"
        message={`Delete "${deleting?.full_name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      <CrudFormDialog<AssignCabinForm>
        open={Boolean(assigningCabinTo)}
        title={`Assign cabin to ${assigningCabinTo?.full_name ?? ''}`}
        fields={assignCabinFields}
        schema={assignCabinSchema}
        defaultValues={{ cabin_id: '', send_welcome_message: false }}
        onClose={() => setAssigningCabinTo(null)}
        onSubmit={handleAssignCabin}
        isSubmitting={isAssigningCabin}
        serverError={serverError}
        submitLabel="Assign"
      />

      <ConfirmDialog
        open={Boolean(removingCabinFrom)}
        title="Release cabin"
        message={`Release cabin "${removingCabinFrom?.cabin_number}" from "${removingCabinFrom?.full_name}"? It will become available for other students.`}
        confirmLabel="Release"
        onConfirm={handleRemoveCabin}
        onCancel={() => setRemovingCabinFrom(null)}
      />

      <CrudFormDialog<AssignLockerForm>
        open={Boolean(assigningLockerTo)}
        title={`Assign locker to ${assigningLockerTo?.full_name ?? ''}`}
        fields={assignLockerFields}
        schema={assignLockerSchema}
        defaultValues={{ locker_id: '' }}
        onClose={() => setAssigningLockerTo(null)}
        onSubmit={handleAssignLocker}
        isSubmitting={isAssigningLocker}
        serverError={serverError}
        submitLabel="Assign"
      />

      <ConfirmDialog
        open={Boolean(removingLockerFrom)}
        title="Release locker"
        message={`Release locker "${removingLockerFrom?.locker_number}" from "${removingLockerFrom?.full_name}"? It will become available for other students.`}
        confirmLabel="Release"
        onConfirm={handleRemoveLocker}
        onCancel={() => setRemovingLockerFrom(null)}
      />

      <CrudFormDialog<RecordPaymentForm>
        open={Boolean(recordingPaymentFor)}
        title={`Record payment for ${recordingPaymentFor?.full_name ?? ''}`}
        fields={recordPaymentFields}
        schema={recordPaymentSchema}
        defaultValues={{
          amount: 0,
          frequency: 'monthly',
          period_start: recordingPaymentFor?.expiry_date ?? dayjs().format('YYYY-MM-DD'),
          period_end: '',
          number_of_months: 1,
          payment_method: 'cash',
          transaction_reference: '',
          notes: '',
        }}
        onClose={() => setRecordingPaymentFor(null)}
        onSubmit={handleRecordPayment}
        isSubmitting={isRecordingPayment}
        serverError={serverError}
        submitLabel="Record payment"
      />

      {SnackbarElement}
    </>
  )
}
