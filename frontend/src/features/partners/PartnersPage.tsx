import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { z } from 'zod'
import { Box, Button, Chip, Tab, Tabs } from '@mui/material'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { ConfirmDialog } from '@/shared/crud/ConfirmDialog'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import {
  useListPartnersQuery,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  useDeletePartnerMutation,
  useGrantLoginMutation,
  type Partner,
} from './partnersApi'
import { SettlementsTab } from './SettlementsTab'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  phone: z.string().optional(),
  share_percentage: z.number().positive('Must be greater than 0').max(100, 'Cannot exceed 100'),
  email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  password: z.string().min(8, 'Must be at least 8 characters').optional().or(z.literal('')),
})

const updateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  phone: z.string().optional(),
  share_percentage: z.number().positive('Must be greater than 0').max(100, 'Cannot exceed 100'),
  is_active: z.boolean(),
})

const grantLoginSchema = z.object({
  email: z.string().email('Must be a valid email'),
  password: z.string().min(8, 'Must be at least 8 characters'),
})

type CreateForm = z.infer<typeof createSchema>
type UpdateForm = z.infer<typeof updateSchema>
type GrantLoginForm = z.infer<typeof grantLoginSchema>

const createFields: CrudField[] = [
  { name: 'name', label: 'Partner name', type: 'text', required: true },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'share_percentage', label: 'Share percentage (%)', type: 'decimal', required: true },
  { name: 'email', label: 'Login email', type: 'text', helperText: 'Optional — grants this partner login access to the app' },
  { name: 'password', label: 'Login password', type: 'text', helperText: 'Share this with the partner — shown only once', visible: (v) => Boolean(v.email) },
]

const updateFields: CrudField[] = [
  { name: 'name', label: 'Partner name', type: 'text', required: true },
  { name: 'phone', label: 'Phone', type: 'text' },
  { name: 'share_percentage', label: 'Share percentage (%)', type: 'decimal', required: true },
  { name: 'is_active', label: 'Active', type: 'boolean' },
]

const grantLoginFields: CrudField[] = [
  { name: 'email', label: 'Login email', type: 'text', required: true },
  { name: 'password', label: 'Login password', type: 'text', required: true, helperText: 'Share this with the partner — shown only once' },
]

function PartnersTab({ libraryId }: { libraryId: string }) {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
  const { data, isLoading } = useListPartnersQuery({ libraryId, page: paginationModel.page + 1, pageSize: paginationModel.pageSize })
  const [createPartner, { isLoading: isCreating }] = useCreatePartnerMutation()
  const [updatePartner, { isLoading: isUpdating }] = useUpdatePartnerMutation()
  const [deletePartner] = useDeletePartnerMutation()
  const [grantLogin, { isLoading: isGrantingLogin }] = useGrantLoginMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [deleting, setDeleting] = useState<Partner | null>(null)
  const [grantingLoginFor, setGrantingLoginFor] = useState<Partner | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const columns: GridColDef<Partner>[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'phone', headerName: 'Phone', width: 130, valueGetter: (v) => v ?? '—' },
    { field: 'email', headerName: 'Login email', width: 180, valueGetter: (v) => v ?? '—' },
    { field: 'share_percentage', headerName: 'Share %', width: 110, valueFormatter: (v: number) => `${v}%` },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => <Chip size="small" label={params.value ? 'Active' : 'Inactive'} color={params.value ? 'success' : 'default'} />,
    },
    {
      field: '__login',
      headerName: '',
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        params.row.email ? null : (
          <Button
            size="small"
            onClick={() => {
              setServerError(null)
              setGrantingLoginFor(params.row)
            }}
          >
            Grant login
          </Button>
        ),
    },
  ]

  async function handleCreate(values: CreateForm) {
    try {
      await createPartner({
        libraryId,
        body: { ...values, phone: values.phone || null, email: values.email || null, password: values.password || null },
      }).unwrap()
      notify(values.email ? `Partner added — login: ${values.email} / ${values.password}` : 'Partner added')
      setDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleUpdate(values: UpdateForm) {
    if (!editing) return
    try {
      await updatePartner({ libraryId, partnerId: editing.id, body: { ...values, phone: values.phone || null } }).unwrap()
      notify('Partner updated')
      setEditing(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deletePartner({ libraryId, partnerId: deleting.id }).unwrap()
      notify('Partner deleted')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(null)
    }
  }

  async function handleGrantLogin(values: GrantLoginForm) {
    if (!grantingLoginFor) return
    try {
      await grantLogin({ libraryId, partnerId: grantingLoginFor.id, body: values }).unwrap()
      notify(`Login granted — ${values.email} / ${values.password}`)
      setGrantingLoginFor(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  return (
    <>
      <CrudListPage
        title="Partners"
        subtitle="Revenue share partners"
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
        addLabel="Add partner"
        onEdit={(row) => {
          setServerError(null)
          setEditing(row)
        }}
        onDelete={(row) => setDeleting(row)}
      />

      <CrudFormDialog<CreateForm>
        open={dialogOpen}
        title="Add partner"
        fields={createFields}
        schema={createSchema}
        defaultValues={{ name: '', phone: '', share_percentage: 0, email: '', password: '' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        serverError={serverError}
      />

      <CrudFormDialog<UpdateForm>
        open={Boolean(editing)}
        title="Edit partner"
        fields={updateFields}
        schema={updateSchema}
        defaultValues={{
          name: editing?.name ?? '',
          phone: editing?.phone ?? '',
          share_percentage: editing?.share_percentage ?? 0,
          is_active: editing?.is_active ?? true,
        }}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        serverError={serverError}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete partner"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      <CrudFormDialog<GrantLoginForm>
        open={Boolean(grantingLoginFor)}
        title={`Grant login — ${grantingLoginFor?.name ?? ''}`}
        fields={grantLoginFields}
        schema={grantLoginSchema}
        defaultValues={{ email: '', password: '' }}
        onClose={() => setGrantingLoginFor(null)}
        onSubmit={handleGrantLogin}
        submitLabel="Grant login"
        isSubmitting={isGrantingLogin}
        serverError={serverError}
      />

      {SnackbarElement}
    </>
  )
}

export function PartnersPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 3 }, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Partners" />
          <Tab label="Settlements" />
        </Tabs>
      </Box>
      {tab === 0 && <PartnersTab libraryId={libraryId!} />}
      {tab === 1 && <SettlementsTab libraryId={libraryId!} />}
    </Box>
  )
}
