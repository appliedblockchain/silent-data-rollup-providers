import {
  BaseConfig,
  NetworkName,
} from '@appliedblockchain/silentdatarollup-core'
import { JsonRpcApiProviderOptions, Signer } from 'ethers'

export interface SilentDataRollupProviderConfig extends BaseConfig {
  rpcUrl: string
  network?: NetworkName
  chainId?: number
  privateKey?: string
  signer?: Signer
  options?: JsonRpcApiProviderOptions
}
