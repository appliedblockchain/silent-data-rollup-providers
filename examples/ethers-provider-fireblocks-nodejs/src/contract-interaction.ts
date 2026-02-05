import 'dotenv/config'
import {
  ApiBaseUrl,
  ChainId,
  FireblocksWeb3Provider,
} from '@fireblocks/fireblocks-web3-provider'
import { SilentDataRollupContract } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupFireblocksProvider } from '@appliedblockchain/silentdatarollup-ethers-provider-fireblocks'
import {
  ContractRunner,
  formatEther,
  formatUnits,
  Interface,
  parseUnits,
  Wallet,
} from 'ethers'
import { ERC20_ABI } from './constants/erc20Abi'

const REQUIRED_ENV_VARS = [
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

const FIREBLOCKS_API_KEY = process.env.FIREBLOCKS_API_KEY as string
const FIREBLOCKS_PRIVATE_KEY_PATH = process.env
  .FIREBLOCKS_PRIVATE_KEY_PATH as string
const FIREBLOCKS_VAULT_ACCOUNT_ID = process.env
  .FIREBLOCKS_VAULT_ACCOUNT_ID as string
const RPC_URL = process.env.RPC_URL as string
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as string

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

  const signer = accounts[0]
  const fromWalletAddress = await signer.getAddress()

  const tokenContract = new SilentDataRollupContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    runner: signer as unknown as ContractRunner,
    contractMethodsToSign: ['balanceOf'],
  })

  const [decimals, name, symbol] = await Promise.all([
    tokenContract.decimals(),
    tokenContract.name(),
    tokenContract.symbol(),
  ])

  console.log('Contract address:', TOKEN_ADDRESS)
  console.log('Token Name:', name)
  console.log('Token Symbol:', symbol)
  console.log('Decimals:', decimals)

  console.log('\nGetting my token balance before transfer...')
  const balanceBefore = await tokenContract.balanceOf(fromWalletAddress)
  console.log('✅ My token balance:', formatEther(balanceBefore), symbol)

  const randomWallet = Wallet.createRandom()

  const amountToTransfer = parseUnits('10', decimals)

  try {
    console.log(
      `\nTransferring ${formatUnits(amountToTransfer, decimals)} tokens to ${randomWallet.address}...`,
    )
    const iface = new Interface(ERC20_ABI)
    const data = iface.encodeFunctionData('transfer', [
      randomWallet.address,
      amountToTransfer,
    ])
    const txHash = await provider.sendTransaction({
      method: 'eth_sendTransaction',
      params: [
        {
          from: fromWalletAddress,
          to: TOKEN_ADDRESS,
          data,
        },
      ],
    })
    console.log(`Transaction hash: ${txHash}`)
    await provider.waitForTransaction(txHash as string)

    console.log(
      `Sent ${formatUnits(amountToTransfer, decimals)} tokens to ${randomWallet.address}`,
    )
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
  const balanceAfter = await tokenContract.balanceOf(fromWalletAddress)
  console.log('✅ My token balance:', formatEther(balanceAfter), symbol)
}

main().catch(console.error)
