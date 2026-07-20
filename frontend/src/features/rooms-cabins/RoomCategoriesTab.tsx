import { useState } from 'react'
import { z } from 'zod'
import { Box, Button, Chip, IconButton, Tooltip } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import AcUnitIcon from '@mui/icons-material/AcUnitOutlined'
import WhatshotIcon from '@mui/icons-material/WhatshotOutlined'
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { ConfirmDialog } from '@/shared/crud/ConfirmDialog'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import { CabinBulkUploadDialog } from './CabinBulkUploadDialog'
import { RoomCategoryMobileCard } from './RoomCategoryMobileCard'
import {
  useListRoomCategoriesQuery,
  useCreateRoomCategoryMutation,
  useUpdateRoomCategoryMutation,
  useDeleteRoomCategoryMutation,
  useToggleAcMutation,
  type RoomCategory,
} from './roomsCabinsApi'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color_code: z.string().optional(),
  is_ac: z.boolean(),
  display_order: z.number().int().min(0),
})

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color_code: z.string().optional(),
  display_order: z.number().int().min(0),
})

type CreateForm = z.infer<typeof createSchema>
type UpdateForm = z.infer<typeof updateSchema>

const createFields: CrudField[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'color_code', label: 'Color (hex)', type: 'text', helperText: 'e.g. #1976d2' },
  { name: 'is_ac', label: 'AC', type: 'boolean' },
  { name: 'display_order', label: 'Display order', type: 'number' },
]

const updateFields: CrudField[] = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'color_code', label: 'Color (hex)', type: 'text' },
  { name: 'display_order', label: 'Display order', type: 'number' },
]

export function RoomCategoriesTab({ libraryId }: { libraryId: string }) {
  const { data: categories, isLoading } = useListRoomCategoriesQuery(libraryId)
  const [createCategory, { isLoading: isCreating }] = useCreateRoomCategoryMutation()
  const [updateCategory, { isLoading: isUpdating }] = useUpdateRoomCategoryMutation()
  const [deleteCategory] = useDeleteRoomCategoryMutation()
  const [toggleAc] = useToggleAcMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RoomCategory | null>(null)
  const [deleting, setDeleting] = useState<RoomCategory | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)

  const columns: GridColDef<RoomCategory>[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
    {
      field: 'is_ac',
      headerName: 'AC',
      width: 130,
      renderCell: (params) => (
        <Tooltip title={params.row.is_ac_locked ? 'Locked while cabins are occupied' : 'Toggle AC / Non-AC'}>
          <span>
            <IconButton
              size="small"
              disabled={params.row.is_ac_locked}
              onClick={() => toggleAc({ libraryId, categoryId: params.row.id, isAc: !params.row.is_ac }).catch(() => null)}
            >
              {params.row.is_ac ? <AcUnitIcon fontSize="small" color="info" /> : <WhatshotIcon fontSize="small" color="warning" />}
            </IconButton>
          </span>
        </Tooltip>
      ),
    },
    {
      field: 'color_code',
      headerName: 'Color',
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: params.value, border: 1, borderColor: 'divider' }} />
        ) : (
          '—'
        ),
    },
    { field: 'display_order', headerName: 'Order', width: 90 },
    {
      field: 'is_default',
      headerName: 'Default',
      width: 100,
      renderCell: (params) => (params.value ? <Chip size="small" label="Default" /> : null),
    },
  ]

  async function handleCreate(values: CreateForm) {
    try {
      await createCategory({
        libraryId,
        body: { name: values.name, color_code: values.color_code || null, is_ac: values.is_ac, display_order: values.display_order },
      }).unwrap()
      notify('Room category created')
      setDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleUpdate(values: UpdateForm) {
    if (!editing) return
    try {
      await updateCategory({
        libraryId,
        categoryId: editing.id,
        body: { name: values.name, color_code: values.color_code || null, display_order: values.display_order },
      }).unwrap()
      notify('Room category updated')
      setEditing(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteCategory({ libraryId, categoryId: deleting.id }).unwrap()
      notify('Room category deleted')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <CrudListPage
        title="Room Categories"
        subtitle="Define AC / non-AC categories used by your cabins"
        columns={columns}
        rows={categories ?? []}
        rowCount={categories?.length ?? 0}
        loading={isLoading}
        paginationModel={{ page: 0, pageSize: 100 }}
        onPaginationModelChange={() => {}}
        onAdd={() => {
          setServerError(null)
          setDialogOpen(true)
        }}
        addLabel="Add category"
        onEdit={(row) => {
          setServerError(null)
          setEditing(row)
        }}
        onDelete={(row) => setDeleting(row)}
        hideActions={false}
        renderMobileCard={(category) => (
          <RoomCategoryMobileCard
            category={category}
            onToggleAc={() => toggleAc({ libraryId, categoryId: category.id, isAc: !category.is_ac }).catch(() => null)}
            onEdit={() => {
              setServerError(null)
              setEditing(category)
            }}
            onDelete={() => setDeleting(category)}
          />
        )}
        extraToolbar={
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setBulkUploadOpen(true)}>
            Bulk upload cabins
          </Button>
        }
      />

      <CabinBulkUploadDialog open={bulkUploadOpen} libraryId={libraryId} onClose={() => setBulkUploadOpen(false)} />

      <CrudFormDialog<CreateForm>
        open={dialogOpen}
        title="Add room category"
        fields={createFields}
        schema={createSchema}
        defaultValues={{ name: '', color_code: '', is_ac: true, display_order: 0 }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        serverError={serverError}
      />

      <CrudFormDialog<UpdateForm>
        open={Boolean(editing)}
        title="Edit room category"
        fields={updateFields}
        schema={updateSchema}
        defaultValues={{ name: editing?.name ?? '', color_code: editing?.color_code ?? '', display_order: editing?.display_order ?? 0 }}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        serverError={serverError}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete room category"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      {SnackbarElement}
    </>
  )
}
