import './type-extensions'
import { DEBUG_NAMESPACE } from '@appliedblockchain/silentdatarollup-core'
import debug from 'debug'
import { Wallet } from 'ethers'
import { extendProvider } from 'hardhat/config'
import {
  EIP1193Provider,
  HardhatConfig,
  HttpNetworkConfig,
  NetworkConfig,
} from 'hardhat/types'
import { HardhatSilentDataRollupProvider } from './provider'
import { SilentdataNetworkConfig } from './types'

const log = debug(DEBUG_NAMESPACE)

extendProvider(
  async (
    provider: EIP1193Provider,
    config: HardhatConfig,
    network: string,
  ): Promise<EIP1193Provider> => {
    const networkConfig = config.networks[network] as NetworkConfig
    const httpNetworkConfig = networkConfig as HttpNetworkConfig

    if (!httpNetworkConfig.silentdata) {
      log(
        'SilentData configuration not found. Returning the original provider.',
      )
      return provider
    }

    if (!('url' in networkConfig)) {
      throw new Error('Network config is not an HTTP network')
    }

    const accounts = httpNetworkConfig.accounts

    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error('No accounts found in network config')
    }

    if (accounts.length > 1) {
      throw new Error('Multiple accounts not supported')
    }

    const account = accounts[0]
    if (typeof account !== 'string') {
      throw new Error('Account is not a private key string')
    }

    const signer = new Wallet(account)
    const newProvider = new HardhatSilentDataRollupProvider(
      signer,
      provider,
      httpNetworkConfig.silentdata as SilentdataNetworkConfig,
    )

    return newProvider
  },
)
