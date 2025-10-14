import { sdTransport } from '@appliedblockchain/silentdatarollup-viem'
import { BrowserProvider } from 'ethers'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  type Address,
  type CustomTransport,
  type PublicClient,
  type WalletClient,
} from 'viem'

const REQUIRED_ENV_VARS = ['VITE_CHAIN_ID', 'VITE_ROLLUP_RPC_URL'] as const
REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!import.meta.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

export const CHAIN_ID = import.meta.env.VITE_CHAIN_ID
export const RPC_URL = import.meta.env.VITE_ROLLUP_RPC_URL

export const silentDataChain = defineChain({
  id: Number(CHAIN_ID),
  name: 'Silent Data',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
  },
})

let transport: CustomTransport
const getTransport = async (): Promise<CustomTransport> => {
  if (transport) {
    return transport
  }

  const browserProvider = new BrowserProvider(window.ethereum)
  const signer = await browserProvider.getSigner()

  transport = sdTransport({
    chainId: Number(CHAIN_ID),
    rpcUrl: RPC_URL,
    signer,
    delegate: true,
  })

  return transport
}

let publicClient: PublicClient
export const getPublicClient = async (): Promise<PublicClient> => {
  if (publicClient) {
    return publicClient
  }

  const transport = await getTransport()

  publicClient = createPublicClient({
    chain: silentDataChain,
    transport,
  })

  return publicClient
}

const walletClientCache = new Map<Address, WalletClient>()

export const getWalletClient = async (
  address: Address,
): Promise<WalletClient> => {
  if (walletClientCache.has(address)) {
    return walletClientCache.get(address) as WalletClient
  }

  const transport = await getTransport()

  const walletClient = createWalletClient({
    account: address,
    chain: silentDataChain,
    transport,
  })

  walletClientCache.set(address, walletClient)

  return walletClient
}
