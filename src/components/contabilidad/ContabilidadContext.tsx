'use client'
import {createContext,useContext,useState,useRef,useCallback,useEffect,type ReactNode} from 'react'
import {useAuth} from '@/context/AuthContext'
import {apiClient,getErrorMessage} from '@/services/api'
import {Notifier} from '@/utils/Notifier'
import type {BaseContable,PeriodoContable} from '@/lib/contabilidad'

interface Contexto {
  base:BaseContable|null;periodo:PeriodoContable|undefined;periodoId:number|null;
  loading:boolean;busy:boolean;error:string;avisos:string[];
  seleccionar:(id:number)=>void;actualizar:()=>Promise<void>;puede:(op:number)=>boolean;
  actuar:(accion:string,datos?:Record<string,unknown>)=>Promise<Record<string,unknown>>;
  confirmar:(accion:string,titulo:string,datos?:Record<string,unknown>)=>Promise<void>;
}
const Context=createContext<Contexto|null>(null)
export function ContabilidadProvider({children}:{children:ReactNode}){
  const {user}=useAuth()
  const [base,setBase]=useState<BaseContable|null>(null)
  const [periodoId,setPeriodoId]=useState<number|null>(null)
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
  const [error,setError]=useState(''),[avisos,setAvisos]=useState<string[]>([])
  const generation=useRef(0)
  const storageKey=`anf.contabilidad.ejercicio.${user?.id}`
  const cargar=useCallback(async(id:number|null)=>{
    const current=++generation.current
    setLoading(true);setError('')
    try{
      const {data}=await apiClient.get<BaseContable>('/contabilidad',{params:id?{periodo:id}:undefined})
      if(current!==generation.current)return
      setBase(data)
      if(id===null&&data.periodos.length){
        const saved=Number(sessionStorage.getItem(storageKey))
        const seleccionado=data.periodos.find(p=>p.id===saved)??data.periodos.find(p=>p.origen==='CONTABILIDAD'&&p.estado!=='CERRADO')??data.periodos[0]
        setPeriodoId(seleccionado.id)
      }
    }catch(err){if(current===generation.current)setError(getErrorMessage(err,'No se pudo consultar Contabilidad.'))}
    finally{if(current===generation.current)setLoading(false)}
  },[storageKey])
  const invalidar=useCallback(()=>{generation.current++},[])
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)void cargar(periodoId)})
    return()=>{cancelled=true;invalidar()}
  },[cargar,periodoId,invalidar])
  const seleccionar=(id:number)=>{sessionStorage.setItem(storageKey,String(id));setPeriodoId(id)}
  async function actuar(accion:string,datos:Record<string,unknown>={}){
    setBusy(true);setError('');setAvisos([])
    try{
      const {data}=await apiClient.post('/contabilidad',{accion,datos:{periodoId,...datos}})
      setAvisos(data.avisos??[])
      const nuevo=accion==='crear_periodo'?Number(data.periodoId):periodoId
      if(nuevo!==periodoId&&nuevo!==null)seleccionar(nuevo)
      else await cargar(nuevo)
      Notifier.success('Operación guardada.')
      return data
    }catch(err){const mensaje=getErrorMessage(err,'No se pudo completar la operación.');setError(mensaje);throw new Error(mensaje)}
    finally{setBusy(false)}
  }
  async function confirmar(accion:string,title:string,datos:Record<string,unknown>={}){
    const result=await Notifier.confirm({title,text:accion==='publicar'?'El balance general y el estado de resultados se compartirán con el análisis financiero. Revisa que estén completos antes de continuar.':'La acción quedará registrada en la auditoría del ejercicio.'})
    if(result.isConfirmed)await actuar(accion,datos).catch(()=>{})
  }
  const puede=(op:number)=>user?.rol==='ADMIN'||Boolean(user?.accesos.includes(op))
  return <Context.Provider value={{base,periodo:base?.periodos.find(p=>p.id===periodoId),periodoId,loading,busy,error,avisos,seleccionar,actualizar:()=>cargar(periodoId),puede,actuar,confirmar}}>{children}</Context.Provider>
}
export function useContabilidad(){const ctx=useContext(Context);if(!ctx)throw new Error('Falta el contexto contable.');return ctx}
export const dinero=(value:number)=>new Intl.NumberFormat('es-SV',{style:'currency',currency:'USD'}).format(value)
export function estadoDelReporte(periodo:PeriodoContable){
  if(periodo.origen==='HISTORICO')return 'Histórico importado'
  if(periodo.estado==='CERRADO')return 'Final · ejercicio cerrado'
  return periodo.estado==='REVISION'?'Provisional · en revisión':'Provisional · ejercicio abierto'
}
