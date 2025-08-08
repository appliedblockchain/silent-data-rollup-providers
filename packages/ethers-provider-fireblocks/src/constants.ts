import { DEBUG_NAMESPACE } from '@fireblocks/fireblocks-web3-provider'

export const DEBUG_NAMESPACE_SILENTDATA_INTERCEPTOR = `${DEBUG_NAMESPACE}:silentdata-interceptor`

export const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
]
