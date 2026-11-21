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
import { puedeVerPagina } from '@/lib/accesos'
import Link from 'next/link'

function DashboardInner({ children }: { children: ReactNode }) {
  const { isAuthenticated, isRestoring, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isRestoring && !isAuthenticated) {
      router.replace('/')
    }
    if(!isRestoring&&isAuthenticated&&user?.rol==='CONTADOR'&&pathname==='/dashboard')router.replace('/contabilidad')
  }, [isAuthenticated, isRestoring, router, user?.rol, pathname])

  // mientras restaura la sesión (montaje), evita redirección inmediata / parpadeo
  if (isRestoring || !isAuthenticated) return null

  if (user && !puedeVerPagina(pathname, user)) return <MainLayout><p role="alert">No tiene permiso para acceder a este módulo.</p><Link href={user.rol==='CONTADOR'?'/contabilidad':'/dashboard'}>Volver al inicio</Link></MainLayout>
  return <MainLayout key={pathname.startsWith('/contabilidad')?'contabilidad':pathname}>{children}</MainLayout>
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardInner>{children}</DashboardInner>
    </Suspense>
  )
}
