import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { z } from 'zod'
import { Button, Chip } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { ConfirmDialog } from '@/shared/crud/ConfirmDialog'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import { LockerBulkUploadDialog } from './LockerBulkUploadDialog'
import { useListLockersQuery, useCreateLockerMutation, useUpdateLockerMutation, useDeleteLockerMutation, type Locker } from './lockersApi'

const statusColors: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
  available: 'success',
  occupied: 'default',
  reserved: 'warning',
  maintenance: 'error',
}

const createSchema = z.object({
  locker_number: z.string().min(1, 'Locker number is required').max(20),
  monthly_rent: z.number().min(0, 'Must be 0 or more'),
})

const updateSchema = z.object({
  locker_number: z.string().min(1, 'Locker number is required').max(20),
  monthly_rent: z.number().min(0, 'Must be 0 or more'),
  status: z.string().min(1),
})

type CreateForm = z.infer<typeof createSchema>
type UpdateForm = z.infer<typeof updateSchema>

const createFields: CrudField[] = [
  { name: 'locker_number', label: 'Locker number', type: 'text', required: true },
  { name: 'monthly_rent', label: 'Monthly rent (₹)', type: 'decimal' },
]

const updateFields: CrudField[] = [
  { name: 'locker_number', label: 'Locker number', type: 'text', required: true },
  { name: 'monthly_rent', label: 'Monthly rent (₹)', type: 'decimal' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'available', label: 'Available' },
      { value: 'occupied', label: 'Occupied' },
      { value: 'reserved', label: 'Reserved' },
      { value: 'maintenance', label: 'Maintenance' },
    ],
    required: true,
  },
]

export function LockersPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
  const { data, isLoading } = useListLockersQuery({ libraryId: libraryId!, page: paginationModel.page + 1, pageSize: paginationModel.pageSize })
  const [createLocker, { isLoading: isCreating }] = useCreateLockerMutation()
  const [updateLocker, { isLoading: isUpdating }] = useUpdateLockerMutation()
  const [deleteLocker] = useDeleteLockerMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Locker | null>(null)
  const [deleting, setDeleting] = useState<Locker | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)

  const columns: GridColDef<Locker>[] = [
    { field: 'locker_number', headerName: 'Locker #', flex: 1, minWidth: 120 },
    { field: 'monthly_rent', headerName: 'Monthly rent', width: 140, valueFormatter: (v: number) => `₹${v}` },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => <Chip size="small" label={params.value} color={statusColors[params.value] ?? 'default'} />,
    },
  ]

  async function handleCreate(values: CreateForm) {
    try {
      await createLocker({ libraryId: libraryId!, body: values }).unwrap()
      notify('Locker created')
      setDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleUpdate(values: UpdateForm) {
    if (!editing) return
    try {
      await updateLocker({ libraryId: libraryId!, lockerId: editing.id, body: values }).unwrap()
      notify('Locker updated')
      setEditing(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteLocker({ libraryId: libraryId!, lockerId: deleting.id }).unwrap()
      notify('Locker deleted')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <CrudListPage
        title="Lockers"
        subtitle="Manage locker inventory and rent"
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
        addLabel="Add locker"
        onEdit={(row) => {
          setServerError(null)
          setEditing(row)
        }}
        onDelete={(row) => setDeleting(row)}
        extraToolbar={
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setBulkUploadOpen(true)}>
            Bulk upload
          </Button>
        }
      />

      <LockerBulkUploadDialog open={bulkUploadOpen} libraryId={libraryId!} onClose={() => setBulkUploadOpen(false)} />

      <CrudFormDialog<CreateForm>
        open={dialogOpen}
        title="Add locker"
        fields={createFields}
        schema={createSchema}
        defaultValues={{ locker_number: '', monthly_rent: 0 }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        serverError={serverError}
      />

      <CrudFormDialog<UpdateForm>
        open={Boolean(editing)}
        title="Edit locker"
        fields={updateFields}
        schema={updateSchema}
        defaultValues={{
          locker_number: editing?.locker_number ?? '',
          monthly_rent: editing?.monthly_rent ?? 0,
          status: editing?.status ?? 'available',
        }}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        serverError={serverError}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete locker"
        message={`Delete locker "${deleting?.locker_number}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      {SnackbarElement}
    </>
  )
}
