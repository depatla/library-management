import { baseApi } from '@/shared/api/baseApi'
import type { Page } from '@/features/rooms-cabins/roomsCabinsApi'

export interface ExpenseCategory {
  id: string
  library_id: string | null
  name: string
  is_default: boolean
}

export interface Expense {
  id: string
  library_id: string
  category_id: string
  category_name: string
  amount: number
  expense_date: string
  description: string | null
  receipt_url: string | null
  paid_to: string | null
  recorded_by: string
  recorded_by_name: string | null
}

export interface ExpenseCreate {
  category_id: string
  amount: number
  expense_date: string
  description?: string | null
  receipt_url?: string | null
  paid_to?: string | null
}

export type ExpenseUpdate = Partial<ExpenseCreate>

export const expensesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listExpenseCategories: builder.query<ExpenseCategory[], string>({
      query: (libraryId) => ({ url: `/libraries/${libraryId}/expense-categories`, method: 'GET' }),
      providesTags: ['ExpenseCategory'],
    }),
    createExpenseCategory: builder.mutation<ExpenseCategory, { libraryId: string; name: string }>({
      query: ({ libraryId, name }) => ({ url: `/libraries/${libraryId}/expense-categories`, method: 'POST', data: { name } }),
      invalidatesTags: ['ExpenseCategory'],
    }),
    listExpenses: builder.query<
      Page<Expense>,
      { libraryId: string; page: number; pageSize: number; categoryId?: string; dateFrom?: string; dateTo?: string }
    >({
      query: ({ libraryId, page, pageSize, categoryId, dateFrom, dateTo }) => ({
        url: `/libraries/${libraryId}/expenses`,
        method: 'GET',
        params: { page, page_size: pageSize, category_id: categoryId, date_from: dateFrom, date_to: dateTo },
      }),
      providesTags: ['Expense'],
    }),
    createExpense: builder.mutation<Expense, { libraryId: string; body: ExpenseCreate }>({
      query: ({ libraryId, body }) => ({ url: `/libraries/${libraryId}/expenses`, method: 'POST', data: body }),
      invalidatesTags: ['Expense', 'Dashboard', 'Report'],
    }),
    updateExpense: builder.mutation<Expense, { libraryId: string; expenseId: string; body: ExpenseUpdate }>({
      query: ({ libraryId, expenseId, body }) => ({ url: `/libraries/${libraryId}/expenses/${expenseId}`, method: 'PATCH', data: body }),
      invalidatesTags: ['Expense', 'Dashboard', 'Report'],
    }),
    deleteExpense: builder.mutation<void, { libraryId: string; expenseId: string }>({
      query: ({ libraryId, expenseId }) => ({ url: `/libraries/${libraryId}/expenses/${expenseId}`, method: 'DELETE' }),
      invalidatesTags: ['Expense', 'Dashboard', 'Report'],
    }),
  }),
})

export const {
  useListExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useListExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} = expensesApi
