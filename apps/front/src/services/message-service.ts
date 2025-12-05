'use client'

import Swal from 'sweetalert2'

export const messageService = {
  success(message: string) {
    Swal.fire({
      icon: 'success',
      title: message,
      toast: true,
      position: 'top',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
    })
  },

  error(message: string) {
    Swal.fire({
      icon: 'error',
      title: message,
      toast: true,
      position: 'top',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    })
  },

  info(message: string) {
    Swal.fire({
      icon: 'info',
      title: message,
      toast: true,
      position: 'top',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
    })
  },

  warning(message: string) {
    Swal.fire({
      icon: 'warning',
      title: message,
      toast: true,
      position: 'top',
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
    })
  },
}
