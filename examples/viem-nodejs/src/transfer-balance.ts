import 'dotenv/config'
import {
  defineChain,
  createPublicClient,
  createWalletClient,
  formatEther,
  parseEther,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sdTransport } from '@appliedblockchain/silentdatarollup-viem'

const REQUIRED_ENV_VARS = [
  'CHAIN_ID',
  'PRIVATE_KEY',
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
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex
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

const walletClient = createWalletClient({
  chain: silentDataChain,
  transport,
  account,
})

const main = async () => {
  const fromWalletAddress = account.address

  const balanceBeforeFrom = await publicClient.getBalance({
    address: account.address,
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
    to: TRANSFER_WALLET_ADDRESS,
    value: TRANSFER_VALUE_ETH,
  })
  await publicClient.waitForTransactionReceipt({ hash: txHash })
  console.log(`Transaction hash: ${txHash}\n`)

  const balanceAfterFrom = await publicClient.getBalance({
    address: account.address,
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
