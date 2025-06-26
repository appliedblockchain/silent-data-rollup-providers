import { SIGN_RPC_METHODS as CORE_SIGN_RPC_METHODS } from '@appliedblockchain/silentdatarollup-core'

export const SIGN_RPC_METHODS = [
  ...CORE_SIGN_RPC_METHODS,
  'eth_call',
  'eth_estimateGas',
]

export const DEBUG_NAMESPACE = 'silentdata:fireblocks'

export const DEFAULT_MAX_RETRIES = 25
export const DEFAULT_POLLING_INTERVAL = 2000
