import {
  SilentDataRollupProvider,
  type SilentDataRollupProviderConfig,
} from '@appliedblockchain/silentdatarollup-ethers-provider'
import { custom, type CustomTransport } from 'viem'

export function sdTransport(
  providerConfig: SilentDataRollupProviderConfig,
): CustomTransport {
  const provider = new SilentDataRollupProvider(providerConfig)
  return custom({
    request: async ({ method, params }) => {
      if (
        method === 'eth_sendTransaction' &&
        Array.isArray(params) &&
        params.length > 0
      ) {
        const tx = params[0]
        let gasLimit = tx.gasLimit
        if (!gasLimit) {
          gasLimit = await provider.estimateGas(tx)
        }
        return await provider.signer.sendTransaction({ ...tx, gasLimit })
      }
      return await provider.send(method, params || [])
    },
  })
}
