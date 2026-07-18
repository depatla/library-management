import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery } from './axiosBaseQuery'

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    'Health',
    'Library',
    'RoomCategory',
    'Cabin',
    'Locker',
    'Student',
    'Payment',
    'Expense',
    'ExpenseCategory',
    'Partner',
    'Settlement',
    'Report',
    'QrCode',
    'WhatsappConfig',
    'WhatsappTemplate',
    'WhatsappMessage',
    'AiLog',
    'Dashboard',
    'Staff',
  ],
  endpoints: () => ({}),
})
