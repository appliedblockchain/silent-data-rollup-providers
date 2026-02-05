import 'dotenv/config'
import {
  defineChain,
  createPublicClient,
  createWalletClient,
  formatEther,
  parseEther,
  type Address,
} from 'viem'
import { ApiBaseUrl, ChainId } from '@fireblocks/fireblocks-web3-provider'
import { sdFireblocksTransport } from '@appliedblockchain/silentdatarollup-viem-fireblocks'

const REQUIRED_ENV_VARS = [
  'CHAIN_ID',
  'FIREBLOCKS_API_KEY',
  'FIREBLOCKS_PRIVATE_KEY_PATH',
  'FIREBLOCKS_VAULT_ACCOUNT_ID',
  'RPC_URL',
  'TRANSFER_VALUE_ETH',
  'TRANSFER_WALLET_ADDRESS',
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
const TRANSFER_VALUE_ETH = parseEther(process.env.TRANSFER_VALUE_ETH as string)
const TRANSFER_WALLET_ADDRESS = process.env.TRANSFER_WALLET_ADDRESS as Address

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
  const [fromWalletAddress] = await walletClient.getAddresses()

  if (!fromWalletAddress) {
    throw new Error('No accounts found in Fireblocks vault')
  }

  const balanceBeforeFrom = await publicClient.getBalance({
    address: fromWalletAddress,
  })
  console.log(
    `Balance of "${fromWalletAddress}" is ${formatEther(balanceBeforeFrom)} ETH`,
  )

  const balanceBeforeTo = await publicClient.getBalance({
    address: TRANSFER_WALLET_ADDRESS,
  })
  console.log(
    `Balance of "${TRANSFER_WALLET_ADDRESS}" is ${formatEther(balanceBeforeTo)} ETH\n`,
  )

  console.log(
    `Sending ${formatEther(TRANSFER_VALUE_ETH)} ETH from "${fromWalletAddress}" to "${TRANSFER_WALLET_ADDRESS}"`,
  )
  const txHash = await walletClient.sendTransaction({
    account: fromWalletAddress,
    to: TRANSFER_WALLET_ADDRESS,
    value: TRANSFER_VALUE_ETH,
  })
  await publicClient.waitForTransactionReceipt({ hash: txHash })
  console.log(`Transaction hash: ${txHash}\n`)

  const balanceAfterFrom = await publicClient.getBalance({
    address: fromWalletAddress,
  })
  console.log(
    `Balance of "${fromWalletAddress}" is ${formatEther(balanceAfterFrom)} ETH`,
  )

  const balanceAfterTo = await publicClient.getBalance({
    address: TRANSFER_WALLET_ADDRESS,
  })
  console.log(
    `Balance of "${TRANSFER_WALLET_ADDRESS}" is ${formatEther(balanceAfterTo)} ETH`,
  )
}

main().catch(console.error)
