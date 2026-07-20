import { useState } from 'react'
import { z } from 'zod'
import { Chip } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { ConfirmDialog } from '@/shared/crud/ConfirmDialog'
import { ResponsiveToolbarButton } from '@/shared/crud/ResponsiveToolbarButton'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import { CabinBulkUploadDialog } from './CabinBulkUploadDialog'
import { CabinMobileCard } from './CabinMobileCard'
import {
  useListCabinsQuery,
  useCreateCabinMutation,
  useUpdateCabinMutation,
  useDeleteCabinMutation,
  useListRoomCategoriesQuery,
  type Cabin,
} from './roomsCabinsApi'

const statusColors: Record<string, 'success' | 'default' | 'warning' | 'error'> = {
  available: 'success',
  occupied: 'default',
  reserved: 'warning',
  maintenance: 'error',
}

const createSchema = z.object({
  room_category_id: z.string().min(1, 'Category is required'),
  cabin_number: z.string().min(1, 'Cabin number is required').max(20),
})

const updateSchema = z.object({
  cabin_number: z.string().min(1, 'Cabin number is required').max(20),
  status: z.string().min(1),
})

type CreateForm = z.infer<typeof createSchema>
type UpdateForm = z.infer<typeof updateSchema>

export function CabinsTab({ libraryId }: { libraryId: string }) {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
  const { data: categories } = useListRoomCategoriesQuery(libraryId)
  const { data, isLoading } = useListCabinsQuery({ libraryId, page: paginationModel.page + 1, pageSize: paginationModel.pageSize })
  const [createCabin, { isLoading: isCreating }] = useCreateCabinMutation()
  const [updateCabin, { isLoading: isUpdating }] = useUpdateCabinMutation()
  const [deleteCabin] = useDeleteCabinMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Cabin | null>(null)
  const [deleting, setDeleting] = useState<Cabin | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)

  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }))

  const createFields: CrudField[] = [
    { name: 'room_category_id', label: 'Room category', type: 'select', options: categoryOptions, required: true },
    { name: 'cabin_number', label: 'Cabin number', type: 'text', required: true },
  ]

  const updateFields: CrudField[] = [
    { name: 'cabin_number', label: 'Cabin number', type: 'text', required: true },
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

  const columns: GridColDef<Cabin>[] = [
    { field: 'cabin_number', headerName: 'Cabin #', width: 120 },
    { field: 'room_category_name', headerName: 'Category', flex: 1, minWidth: 140 },
    { field: 'capacity', headerName: 'Capacity', width: 100 },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => <Chip size="small" label={params.value} color={statusColors[params.value] ?? 'default'} />,
    },
  ]

  async function handleCreate(values: CreateForm) {
    try {
      await createCabin({ libraryId, body: values }).unwrap()
      notify('Cabin created')
      setDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleUpdate(values: UpdateForm) {
    if (!editing) return
    try {
      await updateCabin({ libraryId, cabinId: editing.id, body: values }).unwrap()
      notify('Cabin updated')
      setEditing(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteCabin({ libraryId, cabinId: deleting.id }).unwrap()
      notify('Cabin deleted')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <CrudListPage
        title="Cabins"
        subtitle="Manage individual cabins within each room category"
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
        addLabel="Add cabin"
        onEdit={(row) => {
          setServerError(null)
          setEditing(row)
        }}
        onDelete={(row) => setDeleting(row)}
        mobileInlineActions
        renderMobileCard={(cabin) => (
          <CabinMobileCard
            cabin={cabin}
            onEdit={() => {
              setServerError(null)
              setEditing(cabin)
            }}
            onDelete={() => setDeleting(cabin)}
          />
        )}
        extraToolbar={
          <ResponsiveToolbarButton icon={<UploadFileIcon />} label="Bulk upload" onClick={() => setBulkUploadOpen(true)} />
        }
      />

      <CabinBulkUploadDialog open={bulkUploadOpen} libraryId={libraryId} onClose={() => setBulkUploadOpen(false)} />

      <CrudFormDialog<CreateForm>
        open={dialogOpen}
        title="Add cabin"
        fields={createFields}
        schema={createSchema}
        defaultValues={{ room_category_id: '', cabin_number: '' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        serverError={serverError}
      />

      <CrudFormDialog<UpdateForm>
        open={Boolean(editing)}
        title="Edit cabin"
        fields={updateFields}
        schema={updateSchema}
        defaultValues={{ cabin_number: editing?.cabin_number ?? '', status: editing?.status ?? 'available' }}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        serverError={serverError}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete cabin"
        message={`Delete cabin "${deleting?.cabin_number}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      {SnackbarElement}
    </>
  )
}
