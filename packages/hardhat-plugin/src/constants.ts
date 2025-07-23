import { SIGN_RPC_METHODS as CORE_SIGN_RPC_METHODS } from '@appliedblockchain/silentdatarollup-core'

export const SIGN_RPC_METHODS = [
  ...CORE_SIGN_RPC_METHODS,
  'eth_call',
  'eth_estimateGas',
]

export const DEBUG_NAMESPACE = 'hardhat:provider:silentdata'

export const eip721Domain = {
  name: 'Silent Data [Rollup]',
  version: '1',
}
