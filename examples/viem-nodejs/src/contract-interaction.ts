import 'dotenv/config'
import {
  defineChain,
  createPublicClient,
  createWalletClient,
  formatEther,
  type Address,
  type Hex,
  parseUnits,
  formatUnits,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { sdTransport } from '@appliedblockchain/silentdatarollup-viem'
import { SilentDataRollupContract } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { ERC20_ABI } from './constants/erc20Abi'

const REQUIRED_ENV_VARS = [
  'CHAIN_ID',
  'PRIVATE_KEY',
  'RPC_URL',
  'TOKEN_ADDRESS',
] as const

REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

const CHAIN_ID = process.env.CHAIN_ID as string
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex
const RPC_URL = process.env.RPC_URL as string
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as Address

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

const sdrProvider = new SilentDataRollupProvider({
  rpcUrl: RPC_URL,
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
})

const tokenContract = new SilentDataRollupContract({
  address: TOKEN_ADDRESS,
  abi: ERC20_ABI,
  runner: sdrProvider.signer,
  contractMethodsToSign: ['balanceOf'],
})

const main = async () => {
  const [decimals, name, symbol] = await Promise.all([
    publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }),
    publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'name',
    }),
    publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }),
  ])

  console.log('Contract address:', TOKEN_ADDRESS)
  console.log('Token Name:', name)
  console.log('Token Symbol:', symbol)
  console.log('Decimals:', decimals)

  console.log('\nGetting my token balance before transfer...')
  const balanceBefore = await tokenContract.balanceOf(account.address)
  console.log('✅ My token balance:', formatEther(balanceBefore), symbol)

  const randomPrivateKey = generatePrivateKey()
  const randomWallet = privateKeyToAccount(randomPrivateKey)

  const amountToTransfer = parseUnits('10', decimals)

  try {
    console.log(
      `\nTransferring ${formatUnits(amountToTransfer, decimals)} tokens to ${randomWallet.address}...`,
    )
    const txHash = await walletClient.writeContract({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [randomWallet.address, amountToTransfer],
    })
    await publicClient.waitForTransactionReceipt({ hash: txHash })

    console.log(
      `Sent ${formatUnits(amountToTransfer, decimals)} tokens to ${randomWallet.address}`,
    )
    console.log('Transaction hash:', txHash)
  } catch (error) {
    console.error('Failed to transfer tokens:', error)
    return
  }

  try {
    console.log('\nGetting random wallet token balance...')
    await tokenContract.balanceOf(randomWallet.address)
  } catch {
    console.error(
      "❌ Ups... I can't get the random wallet token balance. The balanceOf method is protected, only the owner of the address can query it.",
    )
  }

  console.log('\nGetting my token balance after transfer...')
  const balanceAfter = await tokenContract.balanceOf(account.address)
  console.log('✅ My token balance:', formatEther(balanceAfter), symbol)
}

main().catch(console.error)
