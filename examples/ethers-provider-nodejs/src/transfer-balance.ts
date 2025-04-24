import 'dotenv/config'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { formatEther, parseEther, Wallet } from 'ethers'

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
const PRIVATE_KEY = process.env.PRIVATE_KEY as string
const RPC_URL = process.env.RPC_URL as string
const TRANSFER_VALUE_ETH = parseEther(process.env.TRANSFER_VALUE_ETH as string)
const TRANSFER_WALLET_ADDRESS = process.env.TRANSFER_WALLET_ADDRESS as string

const provider = new SilentDataRollupProvider({
  rpcUrl: RPC_URL,
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
})

const main = async () => {
  const fromWalletAddress = await provider.signer.getAddress()

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
  const tx = await provider.signer.sendTransaction({
    to: TRANSFER_WALLET_ADDRESS,
    value: TRANSFER_VALUE_ETH,
  })
  await provider.waitForTransaction(tx.hash)
  console.log(`Transaction hash: ${tx.hash}\n`)

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
