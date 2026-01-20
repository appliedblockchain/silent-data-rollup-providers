import 'dotenv/config'
import { SignatureType } from '@appliedblockchain/silentdatarollup-core'
import '@nomicfoundation/hardhat-ignition-ethers'
import { HardhatUserConfig } from 'hardhat/config'
import '@appliedblockchain/silentdatarollup-hardhat-plugin'
import { PRIVATE_KEY, RPC_URL_PRIVATE } from './src/constants'

const config: HardhatUserConfig = {
  solidity: '0.8.22',
  defaultNetwork: 'sdr',
  networks: {
    sdr: {
      url: RPC_URL_PRIVATE,
      accounts: [PRIVATE_KEY],
      silentdata: {
        authSignatureType: SignatureType.Raw,
      },
    },
  },
}

export default config
