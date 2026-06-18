import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

// Pages
import Dashboard from './pages/Dashboard'
import Department from './pages/Department'
import AiChat from './pages/AiChat'
import Admin from './pages/Admin'
import Login from './pages/Login'
import Profile from './pages/Profile'
import { AuthProvider, useAuth } from './hooks/use-auth'

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  if (loading)
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/department/:id" element={<Department />} />
              <Route path="/ai/:id" element={<AiChat />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </AuthProvider>
)

export default App
