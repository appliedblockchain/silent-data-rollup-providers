import { useCallback } from 'react'
import { SDProviderInstance } from './provider'

export function useSilentDataProvider() {
  const resetSession = useCallback(() => {
    if (SDProviderInstance) {
      SDProviderInstance.resetSession()
    }
  }, [])

  return {
    instance: SDProviderInstance,
    resetSession
  }
}
