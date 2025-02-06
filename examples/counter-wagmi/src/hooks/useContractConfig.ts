import { useCallback, useEffect, useState } from 'react'
import { Address } from 'viem'
import { useChainId } from 'wagmi'

// Add this type for the ABI
type ContractAbi = typeof import('../../contract.json')['abi']

interface UseContractConfigResult {
	contractAddress: Address | undefined
	abi: ContractAbi | undefined
	mounted: boolean
}

export function useContractConfig(): UseContractConfigResult {
	const [contractAddress, setContractAddress] = useState<Address | undefined>(undefined)
	const [mounted, setMounted] = useState(false)
	const [abi, setAbi] = useState<ContractAbi | undefined>(undefined)
	const chainId = useChainId()

  const fetchContractInfo = useCallback(async () => {
    const info = await import('../../contract.json')
    return info
  }, [])

	useEffect(() => {
		setMounted(true)
		fetchContractInfo().then((info) => {
			if (chainId) {
				const address = info.deployments[chainId.toString() as keyof typeof info.deployments]?.address
				setContractAddress(address ? address as Address : undefined)
				setAbi(info.abi)
			}
		})
	}, [fetchContractInfo, chainId])

	return { contractAddress, abi, mounted }
} 

