import 'dotenv/config'
import { defineChain, createPublicClient, formatEther, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sdTransport } from '@appliedblockchain/silentdatarollup-viem'

const REQUIRED_ENV_VARS = ['CHAIN_ID', 'PRIVATE_KEY', 'RPC_URL'] as const
REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

const CHAIN_ID = process.env.CHAIN_ID as string
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex
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

const transport = sdTransport({
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
  rpcUrl: RPC_URL,
})

const publicClient = createPublicClient({
  chain: silentDataChain,
  transport,
})

const account = privateKeyToAccount(PRIVATE_KEY)

const main = async () => {
  const balance = await publicClient.getBalance({ address: account.address })
  console.log(`Balance of "${account.address}" is ${formatEther(balance)} ETH`)
}

main().catch(console.error)
