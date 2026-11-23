import type {ReactNode} from 'react'
import {ContabilidadProvider} from '@/components/contabilidad/ContabilidadContext'
import MarcoContable from '@/components/contabilidad/MarcoContable'
export default function ContabilidadLayout({children}:{children:ReactNode}){
  return <ContabilidadProvider><MarcoContable>{children}</MarcoContable></ContabilidadProvider>
}
