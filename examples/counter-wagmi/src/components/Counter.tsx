import { useRef, useState } from 'react'
import { Plus, Minus, RotateCcw, Copy, Check, Crown } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { useCount, useCounter, useOwner } from '../hooks/useCounter'
import { useContractConfig } from '../hooks/useContractConfig'
import { useChainId } from 'wagmi'
import { formatAddress } from '../lib/utils/format'
import { copyToClipboard } from '../lib/utils/clipboard'

export function Counter() {
  const [copied, setCopied] = useState(false)
  const [ownerCopied, setOwnerCopied] = useState(false)
  const { showToast, removeToast } = useToast()
  const countChain = useCount({ watch: true })
  const { contractAddress } = useContractConfig()
  const chainId = useChainId()
  const owner = useOwner({ watch: true })
  const toastId = useRef<number | undefined>()
  const { writeCounter, isProcessing } = useCounter({
    waitReceipt: true,
    onSent: () => {
      const id = showToast('Transaction is pending...', 'pending', { duration: null })
      toastId.current = id
    },
    onConfirm: () => {
      if (toastId.current !== undefined) {
        setTimeout(() => {
          removeToast(toastId.current!)
          toastId.current = undefined
        }, 1000)
      }
    }
  })

  const handleIncrement = async () => {
    try {
      await writeCounter('increment')
      showToast('Counter increased', 'success')
    } catch {
      showToast('Failed to increment counter', 'error')
    }
  }

  const handleDecrement = async () => {
    try {
      await writeCounter('decrement')
      showToast('Counter decreased', 'success')
    } catch {
      showToast('Failed to decrement counter', 'error')
    }
  }

  const handleReset = async () => {
    try {
      if (countChain !== '0') {
        await writeCounter('reset')
        showToast('Counter reset', 'success')
      }
    } catch {
      showToast('Failed to reset counter', 'error')
    }
  }

  const handleClaimOwnership = async () => {
    try {
      await writeCounter('setOwner')
      showToast('Ownership claimed', 'success')
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message, 'error')
      } else {
        showToast('Failed to claim ownership', 'error')
      }
    }
  }

  const handleCopyAddress = async () => {
    if (!contractAddress) return
    
    await copyToClipboard(contractAddress, {
      onSuccess: () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      onError: () => {
        showToast('Failed to copy address', 'error')
      }
    })
  }

  const handleCopyOwner = async () => {
    if (!owner || owner === '-') return
    
    await copyToClipboard(owner, {
      onSuccess: () => {
        setOwnerCopied(true)
        showToast('Owner address copied', 'success')
        setTimeout(() => setOwnerCopied(false), 2000)
      },
      onError: () => {
        showToast('Failed to copy address', 'error')
      }
    })
  }

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold text-center mb-8 text-gray-800">Counter</h1>
        
        <div className="flex items-center justify-center gap-6 mb-8">
          <button
            onClick={handleDecrement}
            disabled={isProcessing}
            className="w-24 h-14 flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white rounded-full transition-colors"
            aria-label="Decrease"
          >
            <Minus size={20} />
          </button>
          
          <div className="text-5xl font-bold text-gray-700 min-w-[120px] text-center">
            {countChain}
          </div>
          
          <button
            onClick={handleIncrement}
            disabled={isProcessing}
            className="w-24 h-14 flex items-center justify-center bg-gray-800 hover:bg-gray-900 text-white rounded-full transition-colors"
            aria-label="Increase"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 items-center">
          <button
            onClick={handleClaimOwnership}
            className="px-4 py-2 flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors"
            aria-label="Claim Ownership"
            disabled={isProcessing}
          >
            <Crown size={16} />
            Claim Ownership
          </button>

          <button
            onClick={handleReset}
            className="px-4 py-2 flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white rounded-md transition-colors"
            aria-label="Reset"
            disabled={isProcessing}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-400 text-center flex flex-col gap-1">
        <div>
          Contract: {contractAddress ? (
            <span className="inline-flex items-center gap-2">
              <span className="font-mono">{formatAddress(contractAddress)}</span>
              <button
                onClick={handleCopyAddress}
                className="p-1 hover:text-gray-300 transition-colors"
                aria-label="Copy contract address"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </span>
          ) : (
            '--'
          )}
          {chainId && (
            <span className="ml-2">
              (Chain ID: {chainId})
            </span>
          )}
        </div>
        <div>
          Owner: <span className="font-mono">{owner !== '-' ? (
            <span className="inline-flex items-center gap-2">
              <span>{formatAddress(owner)}</span>
              <button
                onClick={handleCopyOwner}
                className="p-1 hover:text-gray-300 transition-colors"
                aria-label="Copy owner address"
              >
                {ownerCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </span>
          ) : '--'}</span>
        </div>
      </div>
    </div>
  )
} 