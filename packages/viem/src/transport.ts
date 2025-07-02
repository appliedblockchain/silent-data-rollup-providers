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
      const txData = (params?.[0] ?? {}) as Record<string, unknown>

      // Fill in the nonce if it's not provided
      if (
        method === 'eth_sendTransaction' &&
        ethersProvider.signer &&
        !txData.nonce
      ) {
        const signerAddress = await ethersProvider.signer.getAddress()
        const nonce = await ethersProvider.getTransactionCount(
          signerAddress,
          'latest',
        )
        txData.nonce = nonce
      }

      // Don't fetch transaction details. For security reasons the RPC fails if we do.
      if (method === 'eth_getBlockByNumber' && Array.isArray(params) && params.length > 1) {
        params[1] = false
      }

      return await ethersProvider.send(method, params || [])
    },
  })

  return transport
}
