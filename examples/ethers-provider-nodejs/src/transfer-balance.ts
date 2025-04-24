import 'dotenv/config'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { formatEther, parseEther, Wallet } from 'ethers'

const REQUIRED_ENV_VARS = [
  'CHAIN_ID',
  'PRIVATE_KEY',
  'RPC_URL',
  'TRANSFER_PRIVATE_KEY',
  'TRANSFER_VALUE_ETH',
] as const

REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

const CHAIN_ID = process.env.CHAIN_ID as string
const PRIVATE_KEY = process.env.PRIVATE_KEY as string
const RPC_URL = process.env.RPC_URL as string
const TRANSFER_PRIVATE_KEY = process.env.TRANSFER_PRIVATE_KEY as string
const TRANSFER_VALUE_ETH = parseEther(process.env.TRANSFER_VALUE_ETH as string)

const provider = new SilentDataRollupProvider({
  rpcUrl: RPC_URL,
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
})

const main = async () => {
  const fromWallet = new Wallet(PRIVATE_KEY)
  const fromWalletAddress = await fromWallet.getAddress()

  const toWallet = new Wallet(TRANSFER_PRIVATE_KEY)
  const toWalletAddress = await toWallet.getAddress()

  const balanceBeforeFrom = await provider.getBalance(fromWalletAddress)
  console.log(
    `Balance of "${fromWalletAddress}" is ${formatEther(balanceBeforeFrom)} ETH`,
  )

  const balanceBeforeTo = await provider.getBalance(toWalletAddress)
  console.log(
    `Balance of "${toWalletAddress}" is ${formatEther(balanceBeforeTo)} ETH\n`,
  )

  console.log(
    `Sending ${formatEther(TRANSFER_VALUE_ETH)} ETH from "${fromWalletAddress}" to "${toWalletAddress}"`,
  )
  const tx = await provider.signer.sendTransaction({
    to: toWalletAddress,
    value: TRANSFER_VALUE_ETH,
  })
  await provider.waitForTransaction(tx.hash)
  console.log(`Transaction hash: ${tx.hash}\n`)

  const balanceAfterFrom = await provider.getBalance(fromWalletAddress)
  console.log(
    `Balance of "${fromWalletAddress}" is ${formatEther(balanceAfterFrom)} ETH`,
  )

  const balanceAfterTo = await provider.getBalance(toWalletAddress)
  console.log(
    `Balance of "${toWalletAddress}" is ${formatEther(balanceAfterTo)} ETH`,
  )
}

main().catch(console.error)
