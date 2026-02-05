import {
  FireblocksWeb3Provider,
  type FireblocksProviderConfig,
} from '@fireblocks/fireblocks-web3-provider'
import { SilentDataRollupFireblocksProvider } from '@appliedblockchain/silentdatarollup-ethers-provider-fireblocks'
import { custom, type CustomTransport } from 'viem'

export function sdFireblocksTransport(
  fireblocksConfig: FireblocksProviderConfig,
): CustomTransport {
  const fireblocksWeb3Provider = new FireblocksWeb3Provider(fireblocksConfig)

  const provider = new SilentDataRollupFireblocksProvider({
    ethereum: fireblocksWeb3Provider,
  })

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
        const payload = {
          method,
          params: [{ ...tx, gasLimit }],
        }
        const txHash = await provider.sendTransaction(payload)
        return txHash
      }
      return await provider.send(method, params || [])
    },
  })
}
