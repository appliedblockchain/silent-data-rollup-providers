import { L2_STANDARD_BRIDGE_ADDRESS } from './constants'
import { getRemoteTokenMetadata } from './utils'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'

export default async function deployERC20CustomBridgeToken(
  {
    remoteTokenAddress,
    remoteTokenNetwork,
  }: {
    remoteTokenAddress: string
    remoteTokenNetwork: string
  },
  hre: HardhatRuntimeEnvironment,
): Promise<string> {
  console.log('\n⚙️ Deploying Custom Bridge ERC-20 Token...\n')

  const { name, symbol } = await getRemoteTokenMetadata(
    {
      remoteTokenAddress,
      remoteTokenNetwork,
    },
    hre,
  )

  const [signer] = await hre.ethers.getSigners()
  console.log(`Using account: ${signer.address}`)

  const MyCustomL2Token = await hre.ethers.getContractFactory('MyCustomL2Token')
  const token = await MyCustomL2Token.deploy(
    L2_STANDARD_BRIDGE_ADDRESS,
    remoteTokenAddress,
    name,
    symbol,
  )

  const deploymentTransaction = token.deploymentTransaction()
  if (!deploymentTransaction) {
    throw new Error('\n❌ Deployment transaction not found')
  }
  console.log(`\nTransaction hash: ${deploymentTransaction.hash}`)
  console.log('Waiting for confirmation...')

  const receipt = await deploymentTransaction.wait()
  if (!receipt) {
    throw new Error('\n❌ Transaction receipt not found')
  }
  console.log(`Transaction confirmed in block: ${receipt.blockNumber}`)

  const localTokenAddress = await token.getAddress()

  console.log('\n✅ Successfully deployed')
  console.log(`Local token address: ${localTokenAddress}`)
  console.log(
    `Remote token address: ${remoteTokenAddress} (${remoteTokenNetwork})`,
  )

  return localTokenAddress
}
