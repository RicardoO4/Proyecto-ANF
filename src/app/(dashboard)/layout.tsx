'use client'

// Equivalente de ProtectedRoute: valida la sesión y aplica MainLayout a
// todas las rutas del dashboard.
//
// El guard vive en un componente interno envuelto en <Suspense> porque
// usePathname()/useRouter() solo tienen valor en runtime y bloquearían
// el prerendering si se usaran al nivel del layout.
import { Suspense, useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import MainLayout from '@/components/MainLayout'

function DashboardInner({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated, router])

  // mientras restaura la sesión (montaje), evita redirección inmediata / parpadeo
  if (!isAuthenticated) return null

  return <MainLayout key={pathname}>{children}</MainLayout>
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardInner>{children}</DashboardInner>
    </Suspense>
  )
}
