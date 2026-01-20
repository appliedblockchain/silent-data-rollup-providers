import { BaseConfig } from '@appliedblockchain/silentdatarollup-core'

export interface FireblocksProviderConfig extends BaseConfig {
  /**
   * When set to true, eth_call requests will be signed
   * with authentication headers, regardless of whether they match signable contracts
   */
  alwaysSignEthCalls?: boolean
}
