import { useCallback, useEffect, useState } from 'react'
import { useConfig, useAccount, useBlockNumber } from 'wagmi'
import { getTransactionCount } from '@wagmi/core'
import { Address } from 'viem/_types/accounts'

export function useNonce({ watch = false }: { watch?: boolean } = {}) {
  const config = useConfig()
  const { address } = useAccount()
  const [nonce, setNonce] = useState(0)
  const blockNumber = useBlockNumber({ watch})

  const getNonce = useCallback(async () => {
    if (!address) return 0
    
    return getTransactionCount(config, { address: address as Address })
  }, [address, config])

  useEffect(() => {
    getNonce().then(setNonce)
  }, [getNonce, blockNumber])

  return { nonce, getNonce }
}
