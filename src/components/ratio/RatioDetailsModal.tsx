'use client'

import React from 'react'
import { Modal } from 'react-bootstrap'

import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import detailsStyles from '@/styles/ratios/RatioDetailsModal.module.css'
import type { RatioResponseDTO } from '@/types'

interface RatioDetailsModalProps {
  show: boolean
  onClose: () => void
  ratio: RatioResponseDTO | null
}

export const RatioDetailsModal = ({ show, onClose, ratio }: RatioDetailsModalProps) => {
  // Función auxiliar para formatear los valores y manejar los nulos
  const formatValue = (value: unknown, type = 'number') => {
    if (value === null || typeof value === 'undefined') {
      return <span className={detailsStyles.valueNotCalculated}>No Calculado</span>
    }

    if (type === 'boolean') {
      return value ? 'Sí' : 'No'
    }

    if (typeof value === 'number') {
      return value.toFixed(2) // Formatea a 2 decimales
    }

    return value as string
  }

  return (
    <Modal show={show} onHide={onClose} centered size="lg" contentClassName={modalStyles.modalContent}>
      <Modal.Header className={modalStyles.modalHeader}>
        <Modal.Title className={modalStyles.modalTitle}>Detalles del Ratio</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {ratio ? (
          <ul className={detailsStyles.detailsList}>
            <li>
              <strong>Empresa:</strong>
              <span>{ratio.empresa?.nombre_empresa || 'N/A'}</span>
            </li>
            <li>
              <strong>Año de Análisis:</strong>
              <span>{ratio.anio_ratio || 'N/A'}</span>
            </li>
            <hr />
            <li>
              <strong>Valor Calculado:</strong>
              <span>{formatValue(ratio.valor_calculado)}</span>
            </li>
            <li>
              <strong>Valor Promedio del Sector:</strong>
              <span>{formatValue(ratio.valor_sector_promedio)}</span>
            </li>
            <li>
              <strong>Diferencia vs. Sector:</strong>
              <span>{formatValue(ratio.diferencia_vs_sector)}</span>
            </li>
            <li>
              <strong>Cumple con Benchmark:</strong>
              <span>{formatValue(ratio.cumple_sector, 'boolean')}</span>
            </li>
            <li className={detailsStyles.interpretationItem}>
              <strong>Interpretación:</strong>
              <p>{ratio.interpretacion || 'No disponible.'}</p>
            </li>
          </ul>
        ) : (
          <p>Cargando detalles...</p>
        )}
      </Modal.Body>

      <Modal.Footer className={modalStyles.modalFooter}>
        <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
          Cerrar
        </button>
      </Modal.Footer>
    </Modal>
  )
}

export default RatioDetailsModal
