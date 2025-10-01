import 'dotenv/config'
import { SignatureType } from '@appliedblockchain/silentdatarollup-core'
import '@nomicfoundation/hardhat-ignition-ethers'
import { HardhatUserConfig } from 'hardhat/config'
import '@appliedblockchain/silentdatarollup-hardhat-plugin'
import { PRIVATE_KEY, RPC_URL } from './src/constants'

const config: HardhatUserConfig = {
  solidity: '0.8.22',
  defaultNetwork: 'sdr',
  networks: {
    sdr: {
      url: RPC_URL,
      accounts: [PRIVATE_KEY],
      // @ts-expect-error silentdata is a SilentdataNetworkConfig
      silentdata: {
        authSignatureType: SignatureType.Raw,
      },
    },
  },
}

export default config
