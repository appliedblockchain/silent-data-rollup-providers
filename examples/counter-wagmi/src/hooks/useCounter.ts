import { useAccount, useConfig, useReadContract, useWriteContract } from 'wagmi';
import { useContractConfig } from './useContractConfig';
import { useNonce } from './useNonce'
import { useCallback, useState } from 'react'
import { waitForTransactionReceipt } from 'wagmi/actions'

type UseReadCounterOptions = {
  watch?: boolean
  refetchInterval?: number
}

type WriteCounterOptions = {
  onSent?: (functionName: string, args?: unknown[]) => void
  onConfirm?: (functionName: string, args?: unknown[]) => void
  onError?: (functionName: string, args?: unknown[]) => void
  waitReceipt?: boolean
}

export function useCounter(options: WriteCounterOptions = {}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const { contractAddress, abi } = useContractConfig()
  const { writeContractAsync } = useWriteContract()
  const { nonce } = useNonce()
  const { address } = useAccount()
  const config = useConfig()

  const writeCounter = useCallback(async (functionName: string, args?: unknown[]) => {
    if (!contractAddress || !abi || !address) return;

    setIsProcessing(true)
    try {
      const hash =await writeContractAsync({
        address: contractAddress,
        abi,
        functionName,
        nonce,
        args
      });
  
      options.onSent?.(functionName, args)
  
      let receipt
  
      if (options.waitReceipt) {
        receipt = await waitForTransactionReceipt(config, { hash })
        options.onConfirm?.(functionName, args)
      }
  
      setIsProcessing(false)
  
      return {
        receipt,
        hash
      }
    } catch (error) {
      options.onError?.(functionName, args)
      setIsProcessing(false)
      throw error
    }
    
  }, [contractAddress, abi, address, writeContractAsync, nonce, config, options])

  return {
    writeCounter,
    isProcessing
  };
}

export function useReadCounter(functionName: string, {
  watch = false,
  refetchInterval = 5_000
}: UseReadCounterOptions = {}) {
  const { contractAddress, abi } = useContractConfig();
  return useReadContract({
    address: contractAddress,
    abi,
    functionName,
    query: {
      enabled: !!contractAddress && !!abi,
      ...(watch ? { refetchInterval } : {}),
      retry: false
    },
    
  })
}

export function useCount(options: UseReadCounterOptions = {}) {
  const { address } = useAccount()
  const { data: count, isError } = useReadCounter('getCountPrivate', options)

  const hasCount = count !== undefined && count !== null && !isError && address !== undefined

  return hasCount ? (count as bigint)?.toString() : '-';
}

export function useOwner(options: UseReadCounterOptions = {}) {
  const { data: owner } = useReadCounter('getOwner', options)

  return owner ? owner as string : '-';
}
