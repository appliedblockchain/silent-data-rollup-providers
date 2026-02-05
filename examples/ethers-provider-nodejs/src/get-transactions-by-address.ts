import 'dotenv/config'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { Wallet } from 'ethers'

const REQUIRED_ENV_VARS = ['CHAIN_ID', 'PRIVATE_KEY', 'RPC_URL'] as const

REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

const CHAIN_ID = process.env.CHAIN_ID as string
const PRIVATE_KEY = process.env.PRIVATE_KEY as string
const RPC_URL = process.env.RPC_URL as string

const provider = new SilentDataRollupProvider({
  rpcUrl: RPC_URL,
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
})

const main = async () => {
  const wallet = new Wallet(PRIVATE_KEY)
  const walletAddress = await wallet.getAddress()
  const transactionsPage1 = await provider.send('sd_getTransactionsByAddress', [
    { address: walletAddress, page: 1, perPage: 10 },
  ])
  console.log(
    'Transactions page 1:',
    JSON.stringify(transactionsPage1, null, 2),
  )
  const transactionsPage2 = await provider.send('sd_getTransactionsByAddress', [
    { address: walletAddress, page: 2, perPage: 10 },
  ])
  console.log(
    'Transactions page 2:',
    JSON.stringify(transactionsPage2, null, 2),
  )
}

main().catch(console.error)
