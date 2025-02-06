"use client"

import { useAccount, useConfig } from 'wagmi'
import { useSilentDataProvider } from './hook'
import { useEffect } from 'react'

export function SDProviderSession() {
  const config = useConfig()
  const { isConnected } = useAccount()
  const { instance, resetSession } = useSilentDataProvider()

  useEffect(() => {
    instance.wagmiConfig = config
  }, [config, instance])


  useEffect(() => {
    if (!isConnected && instance) {
      resetSession()
    }
  }, [isConnected, instance, resetSession])

  return null
}
