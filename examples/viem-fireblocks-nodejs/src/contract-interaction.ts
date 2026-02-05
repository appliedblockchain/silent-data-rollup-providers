import 'dotenv/config'
import {
  defineChain,
  createPublicClient,
  createWalletClient,
  formatEther,
  type Address,
  parseUnits,
  formatUnits,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import {
  ApiBaseUrl,
  ChainId,
  FireblocksWeb3Provider,
} from '@fireblocks/fireblocks-web3-provider'
import { sdFireblocksTransport } from '@appliedblockchain/silentdatarollup-viem-fireblocks'
import { SilentDataRollupContract } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupFireblocksProvider } from '@appliedblockchain/silentdatarollup-ethers-provider-fireblocks'
import { ContractRunner } from 'ethers'
import { ERC20_ABI } from './constants/erc20Abi'

const REQUIRED_ENV_VARS = [
  'CHAIN_ID',
  'FIREBLOCKS_API_KEY',
  'FIREBLOCKS_PRIVATE_KEY_PATH',
  'FIREBLOCKS_VAULT_ACCOUNT_ID',
  'RPC_URL',
  'TOKEN_ADDRESS',
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

const eip1193Provider = new FireblocksWeb3Provider({
  privateKey: FIREBLOCKS_PRIVATE_KEY_PATH,
  apiKey: FIREBLOCKS_API_KEY,
  vaultAccountIds: FIREBLOCKS_VAULT_ACCOUNT_ID,
  chainId: ChainId.SEPOLIA,
  apiBaseUrl: ApiBaseUrl.Sandbox, // Change to ApiBaseUrl.Production for production
  rpcUrl: RPC_URL,
})

const fireblocksProvider = new SilentDataRollupFireblocksProvider({
  ethereum: eip1193Provider,
})

const main = async () => {
  const accounts = await fireblocksProvider.listAccounts()
  if (accounts.length === 0) {
    throw new Error('No accounts found in Fireblocks vault')
  }
  const signer = accounts[0]
  const accountAddress = (await signer.getAddress()) as Address

  const tokenContract = new SilentDataRollupContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    runner: signer as unknown as ContractRunner,
    contractMethodsToSign: ['balanceOf'],
  })

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
  const balanceBefore = await tokenContract.balanceOf(accountAddress)
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
      account: accountAddress,
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
  const balanceAfter = await tokenContract.balanceOf(accountAddress)
  console.log('✅ My token balance:', formatEther(balanceAfter), symbol)
}

main().catch(console.error)
