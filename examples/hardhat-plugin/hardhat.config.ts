import 'dotenv/config'

import { SignatureType } from '@appliedblockchain/silentdatarollup-core'
import '@nomicfoundation/hardhat-ignition-ethers'
import { HardhatUserConfig } from 'hardhat/config'

import '@appliedblockchain/silentdatarollup-hardhat-plugin'

const REQUIRED_ENV_VARS = ['RPC_URL', 'PRIVATE_KEY'] as const

REQUIRED_ENV_VARS.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
})

const RPC_URL = process.env.RPC_URL as string
const PRIVATE_KEY = process.env.PRIVATE_KEY as string

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
  },
}

export default config
