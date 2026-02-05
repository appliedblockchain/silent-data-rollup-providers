import 'dotenv/config'
import {
  ApiBaseUrl,
  ChainId,
  FireblocksWeb3Provider,
} from '@fireblocks/fireblocks-web3-provider'
import { SilentDataRollupFireblocksProvider } from '@appliedblockchain/silentdatarollup-ethers-provider-fireblocks'
import { formatEther, parseEther } from 'ethers'

const REQUIRED_ENV_VARS = [
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

const FIREBLOCKS_API_KEY = process.env.FIREBLOCKS_API_KEY as string
const FIREBLOCKS_PRIVATE_KEY_PATH = process.env
  .FIREBLOCKS_PRIVATE_KEY_PATH as string
const FIREBLOCKS_VAULT_ACCOUNT_ID = process.env
  .FIREBLOCKS_VAULT_ACCOUNT_ID as string
const RPC_URL = process.env.RPC_URL as string
const TRANSFER_VALUE_ETH = parseEther(process.env.TRANSFER_VALUE_ETH as string)
const TRANSFER_WALLET_ADDRESS = process.env.TRANSFER_WALLET_ADDRESS as string

const main = async () => {
  const eip1193Provider = new FireblocksWeb3Provider({
    privateKey: FIREBLOCKS_PRIVATE_KEY_PATH,
    apiKey: FIREBLOCKS_API_KEY,
    vaultAccountIds: FIREBLOCKS_VAULT_ACCOUNT_ID,
    chainId: ChainId.SEPOLIA,
    apiBaseUrl: ApiBaseUrl.Sandbox, // Change to ApiBaseUrl.Production for production
    rpcUrl: RPC_URL,
  })

  const provider = new SilentDataRollupFireblocksProvider({
    ethereum: eip1193Provider,
  })

  const accounts = await provider.listAccounts()
  if (accounts.length === 0) {
    throw new Error('No accounts found in Fireblocks vault')
  }

  const fromWalletAddress = await accounts[0].getAddress()

  const balanceBeforeFrom = await provider.getBalance(fromWalletAddress)
  console.log(
    `Balance of "${fromWalletAddress}" is ${formatEther(balanceBeforeFrom)} ETH`,
  )

  const balanceBeforeTo = await provider.getBalance(TRANSFER_WALLET_ADDRESS)
  console.log(
    `Balance of "${TRANSFER_WALLET_ADDRESS}" is ${formatEther(balanceBeforeTo)} ETH\n`,
  )

  console.log(
    `Sending ${formatEther(TRANSFER_VALUE_ETH)} ETH from "${fromWalletAddress}" to "${TRANSFER_WALLET_ADDRESS}"`,
  )
  const txHash = await provider.sendTransaction({
    method: 'eth_sendTransaction',
    params: [
      {
        from: fromWalletAddress,
        to: TRANSFER_WALLET_ADDRESS,
        value: TRANSFER_VALUE_ETH,
      },
    ],
  })
  console.log(`Transaction hash: ${txHash}\n`)
  await provider.waitForTransaction(txHash as string)

  const balanceAfterFrom = await provider.getBalance(fromWalletAddress)
  console.log(
    `Balance of "${fromWalletAddress}" is ${formatEther(balanceAfterFrom)} ETH`,
  )

  const balanceAfterTo = await provider.getBalance(TRANSFER_WALLET_ADDRESS)
  console.log(
    `Balance of "${TRANSFER_WALLET_ADDRESS}" is ${formatEther(balanceAfterTo)} ETH`,
  )
}

main().catch(console.error)
