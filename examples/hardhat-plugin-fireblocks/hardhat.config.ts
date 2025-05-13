import 'dotenv/config'

import { SignatureType } from '@appliedblockchain/silentdatarollup-core'
import { ApiBaseUrl, ChainId } from '@fireblocks/fireblocks-web3-provider'
import '@nomicfoundation/hardhat-ignition-ethers'
import { HardhatUserConfig } from 'hardhat/config'

import '@appliedblockchain/silentdatarollup-hardhat-plugin-fireblocks'

const REQUIRED_ENV_VARS = [
  'RPC_URL',
  'FIREBLOCKS_API_KEY',
  'FIREBLOCKS_VAULT_ACCOUNT_ID',
  'ASSET_ID',
] as const

REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

const RPC_URL = process.env.RPC_URL
const FIREBLOCKS_API_KEY = process.env.FIREBLOCKS_API_KEY
const FIREBLOCKS_VAULT_ACCOUNT_ID = process.env.FIREBLOCKS_VAULT_ACCOUNT_ID
const ASSET_ID = process.env.ASSET_ID

const fireblocksConfig = {
  privateKey: 'FIREBLOCKS_PATH_TO_PRIVATE_KEY',
  apiKey: FIREBLOCKS_API_KEY,
  assetId: ASSET_ID,
  vaultAccountIds: FIREBLOCKS_VAULT_ACCOUNT_ID, // Note: Currently, only one vault account can be passed to the configuration.
  chainId: ChainId.SEPOLIA,
  apiBaseUrl: ApiBaseUrl.Sandbox,
  rpcUrl: RPC_URL,
}

const config: HardhatUserConfig = {
  solidity: '0.8.22',
  defaultNetwork: 'sdr',
  networks: {
    sdr: {
      url: RPC_URL,
      fireblocks: fireblocksConfig,
      silentdata: {
        authSignatureType: SignatureType.Raw,
      },
    },
  },
}

export default config
