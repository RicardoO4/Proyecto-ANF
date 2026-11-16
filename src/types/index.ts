// Domain types for Proyecto ANF — mirrors the original Spring Boot entities
// and the exact JSON shapes the frontend expects (camelCase vs snake_case
// asymmetries are intentional and must be preserved).

// ---------------------------------------------------------
// usuario module
// ---------------------------------------------------------
export interface OpcionFormRow {
  id_opcion: string;
  des_opcion: string;
  num_form: number;
}

export interface UsuarioRow {
  usuario_id: number;
  nombre_usuario: string;
  apellido_usuario: string;
  user_name: string;
  contrasena: string;
  rol: string;
  auth_user_id: string | null;
}

export interface AccesoUsuarioRow {
  acceso_id: number;
  usuario_id: number;
  id_opcion: string;
  empresa_id: number | null;
}

// GET/POST /api/v1/usuarios
export interface UsuarioResponseDTO {
  usuarioId: number;
  nombreUsuario: string;
  apellidoUsuario: string;
  userName: string;
  rol: string;
}

export interface UsuarioRequestDTO {
  nombreUsuario: string;
  apellidoUsuario: string;
  userName: string;
  contrasena?: string | null;
  rol: string;
}

// POST /api/auth/login response
export interface LoginResponse {
  token: string;
  userName: string;
  rol: string;
  id: number;
  accesos: number[];
}

// ---------------------------------------------------------
// empresa module
// ---------------------------------------------------------
export interface SectorRow {
  id_sector: number;
  nombre_sector: string;
  descripcion: string | null;
  pais_referencia: string | null;
  fuente_datos: string | null;
}

export interface SectorDTO {
  idSector: number;
  nombreSector: string;
  descripcion: string | null;
  paisReferencia: string | null;
  fuenteDatos: string | null;
}

export interface EmpresaRow {
  empresa_id: number;
  nombre_empresa: string;
  empresa_dui: string | null;
  empresa_nit: string | null;
  empresa_nrc: string | null;
  usuario_id: number | null;
  id_sector: number | null;
}

export interface EmpresaResponseDTO {
  empresaId: number;
  nombreEmpresa: string;
  empresaDui: string | null;
  empresaNit: string | null;
  empresaNrc: string | null;
  usuarioId: number | null;
  idSector: number | null;
  nombreSector: string | null;
}

export interface ParametroSectorRow {
  id_parametro_sector: number;
  nombre_ratio: string;
  valor_referencia: number;
  fuente: string | null;
  anio_referencia: number | null;
  id_sector: number | null;
  id_categoria_ratio: number | null;
}

// GET /api/v1/parametros-sector — nested shape with snake_case keys
export interface ParametroSectorResponseDTO {
  idParametroSector: number;
  nombreRatio: string;
  valorReferencia: number;
  fuente: string | null;
  anioReferencia: number | null;
  sector: {
    id_sector: number;
    nombre_sector: string;
  } | null;
  categoriaRatio: {
    id_categoria_ratio: number;
    nombre_categoria: string;
  } | null;
}

export interface ParametroSectorSaveDTO {
  nombreRatio: string;
  valorReferencia: number;
  fuente?: string | null;
  anioReferencia?: number | null;
  id_sector: number;
  id_categoria_ratio: number;
}

// ---------------------------------------------------------
// catalogo module
// ---------------------------------------------------------
export interface CuentaRow {
  cuenta_id: number;
  cue_cuenta_id: string;
  nombre_cuenta: string;
  codigo_individual: string | null;
  codigo_generado: string | null;
  tipo_cuenta: string | null;
  id_cuenta_padre: number | null;
  is_postable: boolean;
}

export interface CuentaNodeDTO {
  cuentaId: number;
  codigoCuenta: string;
  nombreCuenta: string;
  esMovimiento: boolean;
  children: CuentaNodeDTO[];
}

export interface CatalogoRow {
  id_catalogo: number;
  activo: boolean;
  empresa_id: number;
  cuenta_id: number;
}

export interface CatalogoResponseDTO {
  idCatalogo: number;
  activo: boolean;
  empresaId: number;
  cuentaId: number;
  codigoCuenta: string;
  nombreCuenta: string;
  tipoCuenta: string | null;
  esMovimiento: boolean;
}

export interface ActivacionRequestDTO {
  empresaId: number;
  cuentaIds: number[];
}

export interface DesactivacionRequestDTO {
  catalogoIds: number[];
}

// ---------------------------------------------------------
// estadofinanciero module
// ---------------------------------------------------------
export interface EstadoFinancieroRow {
  id_estado_financiero: number;
  anio: number;
  tipo_reporte: string;
  empresa_id: number;
}

export interface LineaEstadoFinancieroRow {
  id_linea: number;
  saldo: number;
  id_estado_financiero: number;
  cuenta_id: number;
}

export interface EstadoFinancieroRequestDTO {
  empresaId: number;
  anio: number;
  tipoReporte: string;
  lineas: { cuentaId: number; saldo: number }[];
}

export interface EstadoFinancieroResponseDTO {
  id: number;
  anio: number;
  tipoReporte: string;
  empresaId: number;
  nombreEmpresa: string;
  lineas: LineaEstadoFinancieroResponseDTO[];
}

export interface LineaEstadoFinancieroResponseDTO {
  id: number;
  saldo: number;
  cuentaId: number;
  codigoCuenta: string;
  nombreCuenta: string;
}

// ---------------------------------------------------------
// analisis module
// ---------------------------------------------------------
export interface TipoRatioRow {
  id_tipo_ratio: number;
  nombre_ratio: string;
  codigo_ratio: string | null;
  descripcion: string | null;
  unidad_ratio: string | null;
}

// TipoRatio*DTOs are ALL snake_case (as in the original)
export interface TipoRatioResponseDTO {
  id_tipo_ratio: number;
  nombre_ratio: string;
  codigo_ratio: string | null;
  descripcion: string | null;
  unidad_ratio: string | null;
}

export interface CategoriaRatioRow {
  id_categoria_ratio: number;
  nombre_tipo: string;
  descripcion: string | null;
  id_tipo_ratio: number;
}

export interface CategoriaRatioResponseDTO {
  idCategoriaRatio: number;
  nombreTipo: string;
  descripcion: string | null;
  nombreTipoRatio: string | null;
  idTipoRatio?: number;
}

export interface RatioRow {
  id_ratio: number;
  anio_ratio: number | null;
  periodo_ratio: string | null;
  valor_calculado: number | null;
  valor_sector_promedio: number | null;
  diferencia_vs_sector: number | null;
  cumple_sector: boolean | null;
  interpretacion: string | null;
  empresa_id: number;
  id_categoria_ratio: number | null;
  id_parametro_sector: number | null;
}

export interface RatioResponseDTO {
  id_ratio: number;
  anio_ratio: number | null;
  periodo_ratio: string | null;
  valor_calculado: number | null;
  valor_sector_promedio: number | null;
  diferencia_vs_sector: number | null;
  cumple_sector: boolean | null;
  interpretacion: string | null;
  empresa: {
    empresa_id: number;
    nombre_empresa: string;
  };
  categoriaRatio: {
    id_categoria_ratio: number;
    nombre_categoria: string;
  } | null;
  parametroSector: {
    id_parametro_sector: number;
    valor_referencia: number;
    anio_referencia: number | null;
    nombreRatio: string;
  } | null;
}

export interface LineaAnalisisDTO {
  codigoCuenta: string;
  nombreCuenta: string;
  saldoAnio1: number;
  saldoAnio2: number;
  variacionAbsoluta: number;
  variacionRelativa: number;
  porcentajeVerticalAnio1: number;
  porcentajeVerticalAnio2: number;
  /** Módulo B (B3): which report this line belongs to. */
  tipoReporte?: 'BALANCE_GENERAL' | 'ESTADO_RESULTADOS';
}

export interface ReporteInternoDTO {
  empresaId: number;
  anio1: number;
  anio2: number;
  analisisHorizontal: LineaAnalisisDTO[];
  analisisVertical: LineaAnalisisDTO[];
}

// ---------------------------------------------------------
// proyeccion module
// ---------------------------------------------------------
export interface VentaRow {
  id_venta: number;
  fecha_venta: string;
  monto_venta: number;
  observacion: string | null;
  empresa_id: number;
}

// DTO as returned to the frontend (matches VentaHistoricaDTO)
export interface VentaHistoricaDTO {
  id: number;
  fechaVenta: string;
  montoVenta: number;
  observacion: string | null;
  empresaId: number | null; // never filled by the original backend
}

export interface ProyeccionDTO {
  fechaProyectada: string;
  montoProyectado: number;
}

export type MetodoProyeccion =
  | 'MINIMOS_CUADRADOS'
  | 'INCREMENTO_PORCENTUAL'
  | 'INCREMENTO_ABSOLUTO';

// ---------------------------------------------------------
// shared error shape (mirrors Spring GlobalExceptionHandler)
// ---------------------------------------------------------
export interface ErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}
