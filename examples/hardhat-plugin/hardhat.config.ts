import 'dotenv/config'
import { SignatureType } from '@appliedblockchain/silentdatarollup-core'
import '@nomicfoundation/hardhat-ignition-ethers'
import { task, type HardhatUserConfig } from 'hardhat/config'
import '@appliedblockchain/silentdatarollup-hardhat-plugin'
import {
  deployERC20StandardBridgeToken,
  deployERC20CustomBridgeToken,
} from './tasks'

const REQUIRED_ENV_VARS = [
  'ETHEREUM_URL',
  'PRIVATE_KEY',
  'RPC_URL',
  'SEPOLIA_URL',
] as const

REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

const ETHEREUM_URL = process.env.ETHEREUM_URL as string
const PRIVATE_KEY = process.env.PRIVATE_KEY as string
const RPC_URL = process.env.RPC_URL as string
const SEPOLIA_URL = process.env.SEPOLIA_URL as string

task('deployERC20StandardBridgeToken', 'Deploys a Standard Bridge ERC-20 Token')
  .addParam('remoteTokenAddress', 'Remote token address')
  .addParam('remoteTokenNetwork', 'Remote token network')
  .setAction(deployERC20StandardBridgeToken)

task('deployERC20CustomBridgeToken', 'Deploys a Custom Bridge ERC-20 Token')
  .addParam('remoteTokenAddress', 'Remote token address')
  .addParam('remoteTokenNetwork', 'Remote token network')
  .setAction(deployERC20CustomBridgeToken)

const config: HardhatUserConfig = {
  solidity: '0.8.22',
  defaultNetwork: 'sdr',
  networks: {
    sdr: {
      url: RPC_URL,
      accounts: [PRIVATE_KEY], // Note: Currently, only one private key can be passed to the network accounts configuration.
      silentdata: {
        authSignatureType: SignatureType.Raw,
      },
    },
    ethereum: {
      url: ETHEREUM_URL,
      accounts: [PRIVATE_KEY],
    },
    sepolia: {
      url: SEPOLIA_URL,
      accounts: [PRIVATE_KEY],
    },
  },
}

export default config
