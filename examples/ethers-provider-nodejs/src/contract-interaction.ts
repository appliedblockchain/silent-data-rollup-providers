import 'dotenv/config'
import { SilentDataRollupContract } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import {
  ContractRunner,
  formatEther,
  formatUnits,
  parseUnits,
  Wallet,
} from 'ethers'
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
const PRIVATE_KEY = process.env.PRIVATE_KEY as string
const RPC_URL = process.env.RPC_URL as string
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as string

const provider = new SilentDataRollupProvider({
  rpcUrl: RPC_URL,
  chainId: Number(CHAIN_ID),
  privateKey: PRIVATE_KEY,
})

const tokenContract = new SilentDataRollupContract({
  address: TOKEN_ADDRESS,
  abi: ERC20_ABI,
  runner: provider.signer as unknown as ContractRunner,
  contractMethodsToSign: ['balanceOf'],
})

const main = async () => {
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
  const balanceBefore = await tokenContract.balanceOf(
    await provider.signer.getAddress(),
  )
  console.log('✅ My token balance:', formatEther(balanceBefore), symbol)

  const randomWallet = Wallet.createRandom()

  const amountToTransfer = parseUnits('10', decimals)

  try {
    console.log(
      `\nTransferring ${formatUnits(amountToTransfer, decimals)} tokens to ${randomWallet.address}...`,
    )
    const tx = await tokenContract.transfer(
      randomWallet.address,
      amountToTransfer,
    )
    await tx.wait()

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
  const balanceAfter = await tokenContract.balanceOf(
    await provider.signer.getAddress(),
  )
  console.log('✅ My token balance:', formatEther(balanceAfter), symbol)
}

main().catch(console.error)
