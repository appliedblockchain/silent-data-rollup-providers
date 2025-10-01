import {} from '@appliedblockchain/silentdatarollup-core'
import {
  SilentDataRollupProvider,
  SilentDataRollupProviderConfig,
} from '@appliedblockchain/silentdatarollup-ethers-provider'
import { custom, CustomTransport } from 'viem'

export const sdTransport = (
  config: SilentDataRollupProviderConfig,
): CustomTransport => {
  const providerConfig: SilentDataRollupProviderConfig = config
  const ethersProvider = new SilentDataRollupProvider(providerConfig)
  const transport = custom({
    request: async ({ method, params }) => {
      // Don't fetch transaction details. For security reasons the RPC fails if we do.
      if (
        method === 'eth_getBlockByNumber' &&
        Array.isArray(params) &&
        params.length > 1
      ) {
        params[1] = false
      }

      return await ethersProvider.send(method, params || [])
    },
  })

  return transport
}
