import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

// Convenience only: hides admin screens from normal users. The server enforces the role on every admin request.
export default function AdminRoute() {
  const { currentUser } = useAuth()
  return currentUser?.role === 'admin' ? <Outlet /> : <Navigate to="/home" replace />
}
