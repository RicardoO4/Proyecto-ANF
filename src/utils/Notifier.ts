// Notifier — mixed toast (react-hot-toast) + Swal dialogs, same API as the original.
import Swal from 'sweetalert2'
import { toast } from 'react-hot-toast'

const swalCustomClasses = {
  popup: 'swal-popup-custom',
  title: 'swal-title-custom',
  htmlContainer: 'swal-html-container-custom',
  icon: 'swal-icon-custom',
  confirmButton: 'swal-button-confirm-custom',
  cancelButton: 'swal-button-cancel-custom',
}

export const Notifier = {
  success: (message = '¡Operación exitosa!') => toast.success(message),
  error: (message = 'Ocurrió un error.') => toast.error(message),
  info: (message: string) => toast(message, { icon: 'ℹ️' }),
  warning: (message: string) => toast(message, { icon: '⚠️' }),
  loading: (message = 'Cargando...') => toast.loading(message),
  dismiss: (toastId?: string) => toast.dismiss(toastId),
  showError: (title: string, text: string) => {
    return Swal.fire({
      title,
      text,
      icon: 'error',
      confirmButtonText: 'Entendido',
      customClass: swalCustomClasses,
    })
  },
  confirm: ({ title, text, confirmButtonText = 'Sí, continuar' }: { title: string; text?: string; confirmButtonText?: string }) => {
    return Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancelar',
      customClass: swalCustomClasses,
    })
  },
}
