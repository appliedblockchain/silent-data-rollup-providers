import 'dotenv/config'
import {
  defineChain,
  createPublicClient,
  createWalletClient,
  formatEther,
} from 'viem'
import { ApiBaseUrl, ChainId } from '@fireblocks/fireblocks-web3-provider'
import { sdFireblocksTransport } from '@appliedblockchain/silentdatarollup-viem-fireblocks'

const REQUIRED_ENV_VARS = [
  'CHAIN_ID',
  'FIREBLOCKS_API_KEY',
  'FIREBLOCKS_PRIVATE_KEY_PATH',
  'FIREBLOCKS_VAULT_ACCOUNT_ID',
  'RPC_URL',
] as const

REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

const CHAIN_ID = process.env.CHAIN_ID as string
const FIREBLOCKS_API_KEY = process.env.FIREBLOCKS_API_KEY as string
const FIREBLOCKS_PRIVATE_KEY_PATH = process.env
  .FIREBLOCKS_PRIVATE_KEY_PATH as string
const FIREBLOCKS_VAULT_ACCOUNT_ID = process.env
  .FIREBLOCKS_VAULT_ACCOUNT_ID as string
const RPC_URL = process.env.RPC_URL as string

const silentDataChain = defineChain({
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

const transport = sdFireblocksTransport({
  privateKey: FIREBLOCKS_PRIVATE_KEY_PATH,
  apiKey: FIREBLOCKS_API_KEY,
  vaultAccountIds: FIREBLOCKS_VAULT_ACCOUNT_ID,
  chainId: ChainId.SEPOLIA,
  apiBaseUrl: ApiBaseUrl.Sandbox, // Change to ApiBaseUrl.Production for production
  rpcUrl: RPC_URL,
})

const publicClient = createPublicClient({
  chain: silentDataChain,
  transport,
})

const walletClient = createWalletClient({
  chain: silentDataChain,
  transport,
})

const main = async () => {
  const [walletAddress] = await walletClient.getAddresses()

  if (!walletAddress) {
    throw new Error('No accounts found in Fireblocks vault')
  }

  const balance = await publicClient.getBalance({ address: walletAddress })
  console.log(`Balance of "${walletAddress}" is ${formatEther(balance)} ETH`)
}

main().catch(console.error)
