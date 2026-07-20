import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { z } from 'zod'
import AddIcon from '@mui/icons-material/Add'
import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import { CrudListPage } from '@/shared/crud/CrudListPage'
import { CrudFormDialog, type CrudField } from '@/shared/crud/CrudFormDialog'
import { ConfirmDialog } from '@/shared/crud/ConfirmDialog'
import { ResponsiveToolbarButton } from '@/shared/crud/ResponsiveToolbarButton'
import { useCrudSnackbar, extractErrorMessage } from '@/shared/crud/useCrudSnackbar'
import { ExpenseMobileCard } from './ExpenseMobileCard'
import {
  useListExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useListExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  type Expense,
} from './expensesApi'

const expenseSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  amount: z.number().positive('Must be greater than 0'),
  expense_date: z.string().min(1, 'Date is required'),
  description: z.string().optional(),
  paid_to: z.string().optional(),
})

const categorySchema = z.object({ name: z.string().min(1, 'Name is required').max(100) })

type ExpenseForm = z.infer<typeof expenseSchema>
type CategoryForm = z.infer<typeof categorySchema>

export function ExpensesPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
  const { data, isLoading } = useListExpensesQuery({ libraryId: libraryId!, page: paginationModel.page + 1, pageSize: paginationModel.pageSize })
  const { data: categories } = useListExpenseCategoriesQuery(libraryId!)
  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation()
  const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation()
  const [deleteExpense] = useDeleteExpenseMutation()
  const [createCategory, { isLoading: isCreatingCategory }] = useCreateExpenseCategoryMutation()
  const { notify, SnackbarElement } = useCrudSnackbar()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }))

  const expenseFields: CrudField[] = [
    { name: 'category_id', label: 'Category', type: 'select', options: categoryOptions, required: true },
    { name: 'amount', label: 'Amount (₹)', type: 'decimal', required: true },
    { name: 'expense_date', label: 'Date', type: 'date', required: true },
    { name: 'paid_to', label: 'Paid to', type: 'text' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ]

  const categoryFields: CrudField[] = [{ name: 'name', label: 'Category name', type: 'text', required: true }]

  const columns: GridColDef<Expense>[] = [
    { field: 'category_name', headerName: 'Category', width: 150 },
    { field: 'amount', headerName: 'Amount', width: 110, valueFormatter: (v: number) => `₹${v}` },
    { field: 'expense_date', headerName: 'Date', width: 120 },
    { field: 'paid_to', headerName: 'Paid to', flex: 1, minWidth: 140, valueGetter: (v) => v ?? '—' },
    { field: 'recorded_by_name', headerName: 'Recorded by', width: 140, valueGetter: (v) => v ?? '—' },
  ]

  async function handleCreate(values: ExpenseForm) {
    try {
      await createExpense({
        libraryId: libraryId!,
        body: { ...values, description: values.description || null, paid_to: values.paid_to || null },
      }).unwrap()
      notify('Expense recorded')
      setDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleUpdate(values: ExpenseForm) {
    if (!editing) return
    try {
      await updateExpense({
        libraryId: libraryId!,
        expenseId: editing.id,
        body: { ...values, description: values.description || null, paid_to: values.paid_to || null },
      }).unwrap()
      notify('Expense updated')
      setEditing(null)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteExpense({ libraryId: libraryId!, expenseId: deleting.id }).unwrap()
      notify('Expense deleted')
    } catch (err) {
      notify(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(null)
    }
  }

  async function handleCreateCategory(values: CategoryForm) {
    try {
      await createCategory({ libraryId: libraryId!, name: values.name }).unwrap()
      notify('Category created')
      setCategoryDialogOpen(false)
    } catch (err) {
      setServerError(extractErrorMessage(err))
    }
  }

  return (
    <>
      <CrudListPage
        title="Expenses"
        subtitle="Track operating expenses by category"
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
        addLabel="Add expense"
        onEdit={(row) => {
          setServerError(null)
          setEditing(row)
        }}
        onDelete={(row) => setDeleting(row)}
        mobileInlineActions
        renderMobileCard={(expense) => (
          <ExpenseMobileCard
            expense={expense}
            onEdit={() => {
              setServerError(null)
              setEditing(expense)
            }}
            onDelete={() => setDeleting(expense)}
          />
        )}
        extraToolbar={
          <ResponsiveToolbarButton
            icon={<AddIcon />}
            label="New category"
            onClick={() => {
              setServerError(null)
              setCategoryDialogOpen(true)
            }}
          />
        }
      />

      <CrudFormDialog<ExpenseForm>
        open={dialogOpen}
        title="Add expense"
        fields={expenseFields}
        schema={expenseSchema}
        defaultValues={{ category_id: '', amount: 0, expense_date: '', paid_to: '', description: '' }}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
        serverError={serverError}
      />

      <CrudFormDialog<ExpenseForm>
        open={Boolean(editing)}
        title="Edit expense"
        fields={expenseFields}
        schema={expenseSchema}
        defaultValues={{
          category_id: editing?.category_id ?? '',
          amount: editing?.amount ?? 0,
          expense_date: editing?.expense_date ?? '',
          paid_to: editing?.paid_to ?? '',
          description: editing?.description ?? '',
        }}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        isSubmitting={isUpdating}
        serverError={serverError}
      />

      <CrudFormDialog<CategoryForm>
        open={categoryDialogOpen}
        title="New expense category"
        fields={categoryFields}
        schema={categorySchema}
        defaultValues={{ name: '' }}
        onClose={() => setCategoryDialogOpen(false)}
        onSubmit={handleCreateCategory}
        isSubmitting={isCreatingCategory}
        serverError={serverError}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete expense"
        message={`Delete this expense of ₹${deleting?.amount}? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      {SnackbarElement}
    </>
  )
}
