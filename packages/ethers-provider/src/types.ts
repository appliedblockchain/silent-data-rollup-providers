import {
  BaseConfig,
  NetworkName,
} from '@appliedblockchain/silentdatarollup-core'
import { Filter, JsonRpcApiProviderOptions, Signer } from 'ethers'

export interface SilentDataRollupProviderConfig extends BaseConfig {
  rpcUrl: string
  l1RpcUrl?: string
  registryContract?: string
  network?: NetworkName
  chainId?: number
  privateKey?: string
  signer?: Signer
  options?: JsonRpcApiProviderOptions
  smartWalletAddress?: string
  /**
   * When set to true, all eth_call requests will be signed
   * with authentication headers, regardless of whether they match signable contracts
   */
  alwaysSignEthCalls?: boolean
}

/**
 * Extended filter type that includes a special flag for private events
 * This flag is used to identify when a call to eth_getLogs originated from
 * the getAllLogs method, so we can add authentication headers
 */
export interface PrivateEventsFilter extends Filter {
  /**
   * Internal flag to identify requests that should include auth headers
   * Set automatically by getAllLogs method
   */
  _isPrivateEvent?: boolean

  /**
   * Optional event signature for filtering private events by type
   * Example: "Transfer(address,address,uint256)"
   * Will be converted to a hash and used for topic filtering
   */
  eventSignature?: string
}
