import 'dotenv/config'
import { SignatureType } from '@appliedblockchain/silentdatarollup-core'
import { ApiBaseUrl, ChainId } from '@fireblocks/fireblocks-web3-provider'
import '@nomicfoundation/hardhat-ignition-ethers'
import { type HardhatUserConfig } from 'hardhat/config'
import '@appliedblockchain/silentdatarollup-hardhat-plugin-fireblocks'

const REQUIRED_ENV_VARS = [
  'FIREBLOCKS_API_KEY',
  'FIREBLOCKS_PRIVATE_KEY_PATH',
  'FIREBLOCKS_VAULT_ACCOUNT_ID',
  'RPC_URL',
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

const fireblocksConfig = {
  privateKey: FIREBLOCKS_PRIVATE_KEY_PATH,
  apiKey: FIREBLOCKS_API_KEY,
  vaultAccountIds: FIREBLOCKS_VAULT_ACCOUNT_ID, // Note: Currently, only one vault account can be passed to the configuration.
  chainId: ChainId.SEPOLIA,
  apiBaseUrl: ApiBaseUrl.Sandbox, // Change to ApiBaseUrl.Production for production
  rpcUrl: RPC_URL,
}

const config: HardhatUserConfig = {
  solidity: '0.8.22',
  defaultNetwork: 'sdr',
  networks: {
    sdr: {
      url: fireblocksConfig.rpcUrl,
      fireblocks: fireblocksConfig,
      silentdata: {
        authSignatureType: SignatureType.Raw,
      },
    },
  },
}

export default config
