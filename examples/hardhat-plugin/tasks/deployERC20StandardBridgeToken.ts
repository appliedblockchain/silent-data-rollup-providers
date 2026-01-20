import { OPTIMISM_MINTABLE_ERC20_FACTORY } from './constants'
import { getLocalTokenAddress, getRemoteTokenMetadata } from './utils'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'

export default async function deployERC20StandardBridgeToken(
  {
    remoteTokenAddress,
    remoteTokenNetwork,
  }: {
    remoteTokenAddress: string
    remoteTokenNetwork: string
  },
  hre: HardhatRuntimeEnvironment,
): Promise<string> {
  console.log('\n⚙️ Deploying Standard Bridge ERC-20 Token...\n')

  const { name, symbol } = await getRemoteTokenMetadata(
    {
      remoteTokenAddress,
      remoteTokenNetwork,
    },
    hre,
  )

  const [signer] = await hre.ethers.getSigners()
  console.log(`Using account: ${signer.address}`)

  const l2StandardBridge = new hre.ethers.Contract(
    OPTIMISM_MINTABLE_ERC20_FACTORY.address,
    OPTIMISM_MINTABLE_ERC20_FACTORY.abi,
    signer,
  )

  const transaction = await l2StandardBridge.createOptimismMintableERC20(
    remoteTokenAddress,
    name,
    symbol,
  )
  if (!transaction) {
    throw new Error('\n❌ Transaction not found')
  }
  console.log(`\nTransaction hash: ${transaction.hash}`)
  console.log('Waiting for confirmation...')

  const receipt = await transaction.wait()
  if (!receipt) {
    throw new Error('\n❌ Transaction receipt not found')
  }
  console.log(`Transaction confirmed in block: ${receipt.blockNumber}`)

  const localTokenAddress = await getLocalTokenAddress(
    receipt,
    l2StandardBridge,
  )

  console.log('\n✅ Successfully deployed')
  console.log(`Local token address: ${localTokenAddress}`)
  console.log(
    `Remote token address: ${remoteTokenAddress} (${remoteTokenNetwork})`,
  )

  return localTokenAddress
}
