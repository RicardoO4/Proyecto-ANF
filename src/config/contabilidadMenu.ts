import { House, Calendar3, JournalCheck, PencilSquare, Book, Sliders, FileEarmarkText, Lock, ClockHistory } from 'react-bootstrap-icons'
export const contabilidadLinks = [
  {to:'/contabilidad',label:'Inicio contable',icon:House},
  {to:'/contabilidad/ejercicios',label:'Ejercicios',icon:Calendar3},
  {to:'/contabilidad/catalogo',label:'Catálogo de cuentas',icon:JournalCheck},
  {to:'/contabilidad/transacciones',label:'Transacciones',icon:PencilSquare},
  {to:'/contabilidad/libros',label:'Libros contables',icon:Book},
  {to:'/contabilidad/ajustes',label:'Ajustes y revisión',icon:Sliders},
  {to:'/contabilidad/estados',label:'Estados financieros',icon:FileEarmarkText},
  {to:'/contabilidad/cierre',label:'Publicación y cierre',icon:Lock},
  {to:'/contabilidad/auditoria',label:'Auditoría',icon:ClockHistory},
]
