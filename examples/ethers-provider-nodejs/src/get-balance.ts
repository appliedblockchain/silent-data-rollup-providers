import 'dotenv/config'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { formatEther, Wallet } from 'ethers'

const REQUIRED_ENV_VARS = ['CHAIN_ID', 'PRIVATE_KEY', 'RPC_URL'] as const

REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

const CHAIN_ID = process.env.CHAIN_ID as string
const PRIVATE_KEY = process.env.PRIVATE_KEY as string
const RPC_URL = process.env.RPC_URL as string

// if not set, runs without registry check
const REGISTRY_CONTRACT_ADDRESS = process.env.REGISTRY_CONTRACT_ADDRESS as
  | string
  | undefined
const L1_RPC_URL = process.env.L1_RPC_URL as string | undefined

const provider = new SilentDataRollupProvider({
  rpcUrl: RPC_URL,
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
  l1RpcUrl: L1_RPC_URL,
  registryContract: REGISTRY_CONTRACT_ADDRESS,
})

const main = async () => {
  const wallet = new Wallet(PRIVATE_KEY)
  const walletAddress = await wallet.getAddress()
  const balance = await provider.getBalance(walletAddress)
  console.log(`Balance of "${walletAddress}" is ${formatEther(balance)} ETH`)
}

main().catch(console.error)
