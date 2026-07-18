import { Navigate, Outlet } from 'react-router-dom'
import { useAppSelector } from '@/app/hooks'

export function ProtectedRoute() {
  const status = useAppSelector((s) => s.auth.status)

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export function SuperAdminRoute() {
  const status = useAppSelector((s) => s.auth.status)
  const user = useAppSelector((s) => s.auth.user)

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }
  if (!user?.is_super_admin) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
