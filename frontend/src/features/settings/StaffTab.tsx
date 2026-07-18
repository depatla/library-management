import { useState } from 'react'
import { z } from 'zod'
import { Chip } from '@mui/material'
import type { GridColDef } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { ConfirmDialog } from '@/shared/crud/ConfirmDialog'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import { useListStaffQuery, useInviteStaffMutation, useUpdateStaffRoleMutation, useRemoveStaffMutation, type StaffMember } from './settingsApi'

const ROLE_OPTIONS = [
  { value: 'library_owner', label: 'Library owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
]

const inviteSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(150),
  email: z.string().email('Enter a valid email'),
  role_name: z.string().min(1, 'Role is required'),
})

const roleSchema = z.object({ role_name: z.string().min(1, 'Role is required') })

type InviteForm = z.infer<typeof inviteSchema>
type RoleForm = z.infer<typeof roleSchema>

const inviteFields: CrudField[] = [
  { name: 'full_name', label: 'Full name', type: 'text', required: true },
  { name: 'email', label: 'Email', type: 'text', required: true },
  { name: 'role_name', label: 'Role', type: 'select', options: ROLE_OPTIONS, required: true },
]

const roleFields: CrudField[] = [{ name: 'role_name', label: 'Role', type: 'select', options: ROLE_OPTIONS, required: true }]

const statusColors: Record<string, 'success' | 'default' | 'warning'> = {
  active: 'success',
  invited: 'warning',
  suspended: 'default',
}

type StaffRow = StaffMember & { id: string }

export function StaffTab({ libraryId }: { libraryId: string }) {
  const { data: staff, isLoading } = useListStaffQuery(libraryId)
  const [inviteStaff, { isLoading: isInviting }] = useInviteStaffMutation()
  const [updateRole, { isLoading: isUpdating }] = useUpdateStaffRoleMutation()
  const [removeStaff] = useRemoveStaffMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRow | null>(null)
  const [removing, setRemoving] = useState<StaffRow | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const columns: GridColDef<StaffRow>[] = [
    { field: 'full_name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 180 },
    { field: 'role_name', headerName: 'Role', width: 140, renderCell: (params) => <Chip size="small" label={params.value.replace(/_/g, ' ')} /> },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params) => <Chip size="small" label={params.value} color={statusColors[params.value] ?? 'default'} />,
    },
  ]

  async function handleInvite(values: InviteForm) {
    try {
      await inviteStaff({ libraryId, body: { ...values, role_name: values.role_name as 'library_owner' | 'manager' | 'staff' } }).unwrap()
      notify('Staff member invited')
      setDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleUpdateRole(values: RoleForm) {
    if (!editing) return
    try {
      await updateRole({ libraryId, userId: editing.user_id, roleName: values.role_name }).unwrap()
      notify('Role updated')
      setEditing(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleRemove() {
    if (!removing) return
    try {
      await removeStaff({ libraryId, userId: removing.user_id }).unwrap()
      notify('Staff member removed')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <>
      <CrudListPage
        title="Staff"
        subtitle="Invite and manage staff access to this library"
        columns={columns}
        rows={(staff ?? []).map((s) => ({ ...s, id: s.user_id }))}
        rowCount={staff?.length ?? 0}
        loading={isLoading}
        paginationModel={{ page: 0, pageSize: 100 }}
        onPaginationModelChange={() => {}}
        onAdd={() => {
          setServerError(null)
          setDialogOpen(true)
        }}
        addLabel="Invite staff"
        onEdit={(row) => {
          setServerError(null)
          setEditing(row)
        }}
        onDelete={(row) => setRemoving(row)}
      />

      <CrudFormDialog<InviteForm>
        open={dialogOpen}
        title="Invite staff member"
        fields={inviteFields}
        schema={inviteSchema}
        defaultValues={{ full_name: '', email: '', role_name: 'staff' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleInvite}
        isSubmitting={isInviting}
        serverError={serverError}
        submitLabel="Invite"
      />

      <CrudFormDialog<RoleForm>
        open={Boolean(editing)}
        title="Update role"
        fields={roleFields}
        schema={roleSchema}
        defaultValues={{ role_name: editing?.role_name ?? 'staff' }}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdateRole}
        isSubmitting={isUpdating}
        serverError={serverError}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove staff member"
        message={`Remove "${removing?.full_name}" from this library?`}
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      />

      {SnackbarElement}
    </>
  )
}
