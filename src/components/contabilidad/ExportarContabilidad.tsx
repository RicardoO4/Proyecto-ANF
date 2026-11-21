'use client'
import {useState} from 'react'
import {useContabilidad} from './ContabilidadContext'
import {useEmpresaPrincipal} from '@/hooks/useEmpresaPrincipal'
import {resumenContable,balancePostcierre} from '@/lib/contabilidad'
import buttons from '@/styles/shared/Button.module.css'

export default function ExportarContabilidad(){
  const {base,periodo,busy}=useContabilidad(),{empresa}=useEmpresaPrincipal()
  const [error,setError]=useState(''),[exportando,setExportando]=useState(false)
  async function exportar(){
    if(!base||!periodo)return
    setError('');setExportando(true)
    try{
      const XLSX=await import('xlsx'),resumen=resumenContable(base),wb=XLSX.utils.book_new()
      const add=(nombre:string,filas:object[])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(filas),nombre)
      add('Metadata',[{empresa:empresa?.nombreEmpresa,anio:periodo.anio,origen:periodo.origen,estado:periodo.estado,version:periodo.version,versionPublicada:periodo.version_publicada}])
      add('Comprobacion',base.saldos);add('Balance General',base.estados?.balance??[]);add('Resultados',base.estados?.resultados??[])
      if(periodo.origen==='CONTABILIDAD'){
        add('Estado de Capital',[{patrimonioInicial:resumen.inicial,movimientos:resumen.movimientos,resultado:resumen.utilidad,patrimonioFinal:resumen.patrimonioFinal}])
        add('Diario',base.partidas.flatMap(a=>a.lineas.map(l=>({partida:a.numero,fecha:a.fecha,tipo:a.tipo,estado:a.estado,concepto:a.descripcion,...l}))))
        add('Postcierre',balancePostcierre(base.partidas))
      }
      XLSX.writeFile(wb,`Contabilidad_ANF_${periodo.anio}.xlsx`)
    }catch{setError('No se pudo generar el archivo.')}finally{setExportando(false)}
  }
  return <div><button className={buttons.btnSecondary} disabled={busy||exportando||!periodo} onClick={()=>void exportar()}>{exportando?'Exportando…':'Exportar Excel'}</button>{error&&<p role="alert">{error}</p>}</div>
}
