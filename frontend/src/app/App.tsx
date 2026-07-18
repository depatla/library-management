import { CssBaseline, ThemeProvider } from '@mui/material'
import { useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { buildTheme } from '@/shared/theme/theme'
import { SessionBoot } from '@/features/auth/SessionBoot'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProtectedRoute, SuperAdminRoute } from '@/features/auth/ProtectedRoute'
import { AdminConsolePage } from '@/features/libraries/AdminConsolePage'
import { LibraryPickerPage } from '@/features/libraries/LibraryPickerPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { AppShell } from '@/shared/layout/AppShell'
import { LibraryHomePage } from '@/features/dashboard/LibraryHomePage'
import { RoomsCabinsPage } from '@/features/rooms-cabins/RoomsCabinsPage'
import { LockersPage } from '@/features/lockers/LockersPage'
import { StudentsPage } from '@/features/students/StudentsPage'
import { PaymentsPage } from '@/features/payments/PaymentsPage'
import { ExpensesPage } from '@/features/expenses/ExpensesPage'
import { PartnersPage } from '@/features/partners/PartnersPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { QrCodesPage } from '@/features/qr-codes/QrCodesPage'
import { WhatsappPage } from '@/features/whatsapp/WhatsappPage'
import { AiAssistantPage } from '@/features/ai-assistant/AiAssistantPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { useAppSelector } from '@/app/hooks'

function PostLoginRedirect() {
  const user = useAppSelector((s) => s.auth.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.is_super_admin) return <Navigate to="/admin" replace />
  if (user.memberships.length === 1) return <Navigate to={`/libraries/${user.memberships[0].library_id}`} replace />
  return <Navigate to="/libraries" replace />
}

export function App() {
  const [mode] = useState<'light' | 'dark'>('light')
  const theme = useMemo(() => buildTheme(mode, '#1976d2', '#9c27b0'), [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <SessionBoot>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/_diagnostics" element={<DashboardPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<PostLoginRedirect />} />
              <Route path="/libraries" element={<LibraryPickerPage />} />
              <Route path="/libraries/:libraryId" element={<AppShell />}>
                <Route index element={<LibraryHomePage />} />
                <Route path="rooms-cabins" element={<RoomsCabinsPage />} />
                <Route path="lockers" element={<LockersPage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="partners" element={<PartnersPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="qr-codes" element={<QrCodesPage />} />
                <Route path="whatsapp" element={<WhatsappPage />} />
                <Route path="ai-assistant" element={<AiAssistantPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route element={<SuperAdminRoute />}>
              <Route path="/admin" element={<AdminConsolePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SessionBoot>
      </BrowserRouter>
    </ThemeProvider>
  )
}
