'use client'

import { useState, useEffect } from 'react'

export function useIsTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          (navigator as unknown as { msMaxTouchPoints?: number }).msMaxTouchPoints > 0,
      )
    }

    checkTouchDevice()
  }, [])

  return isTouchDevice
}
