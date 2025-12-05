'use client'

import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import { LogoIcon } from '@/components/icons'

const MySwal = withReactContent(Swal)

const baseConfig = {
  background: '#0f172a',
  color: '#f8fafc',
  confirmButtonColor: '#6366f1',
  cancelButtonColor: '#334155',
  buttonsStyling: false, // We will use custom classes
  customClass: {
    popup: 'border border-[#1e293b] rounded-2xl shadow-2xl shadow-black/50 !p-0 !overflow-hidden',
    // title: '!text-xl !font-bold !text-white !mt-6 !mb-2', // Removed standard title class to handle manually
    htmlContainer: '!text-[#9ca3af] !m-0 !px-6 !pb-6',
    actions: '!mt-0 !mb-6 !gap-3',
    confirmButton: 'inline-flex items-center justify-center px-6 py-2.5 bg-[#6366f1] hover:bg-[#5558e6] text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-indigo-500/20 min-w-[100px]',
    cancelButton: 'inline-flex items-center justify-center px-6 py-2.5 bg-[#1e293b] hover:bg-[#334155] text-[#e2e8f0] rounded-xl font-medium text-sm transition-colors border border-[#334155] min-w-[100px]',
  },
  width: 400,
  padding: 0,
}

const LogoHeader = () => (
  <div className="w-full flex justify-center pt-8 pb-6">
    <div className="w-16 h-16 flex items-center justify-center">
      <LogoIcon className="w-full h-full" />
    </div>
  </div>
)

export const showAlert = (title: string, text?: string) => {
  return MySwal.fire({
    ...baseConfig,
    title: '', // Hide default title
    html: (
      <div className="flex flex-col items-center">
        <LogoHeader />
        {title && <h2 className="text-xl font-bold text-white mb-2">{title}</h2>}
        {text && <p className="text-center leading-relaxed">{text}</p>}
      </div>
    ),
    showConfirmButton: true,
    confirmButtonText: '确定',
  })
}

export const showConfirm = async (title: string, text?: string, confirmText = '确定', cancelText = '取消') => {
  const result = await MySwal.fire({
    ...baseConfig,
    title: '', // Hide default title
    html: (
      <div className="flex flex-col items-center">
        <LogoHeader />
        {title && <h2 className="text-xl font-bold text-white mb-2">{title}</h2>}
        {text && <p className="text-center leading-relaxed">{text}</p>}
      </div>
    ),
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
  })
  return result.isConfirmed
}

// Helper for replacing simple alert() calls
export const novaiAlert = (message: string) => showAlert('', message)

// Helper for replacing simple confirm() calls
export const novaiConfirm = (message: string) => showConfirm('', message)
