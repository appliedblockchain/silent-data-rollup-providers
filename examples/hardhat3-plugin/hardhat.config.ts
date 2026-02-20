import { configVariable, defineConfig } from 'hardhat/config'
import hardhatIgnitionViemPlugin from '@nomicfoundation/hardhat-ignition-viem'
import silentDataPlugin from '@appliedblockchain/silentdatarollup-hardhat3-plugin'
import { SignatureType } from '@appliedblockchain/silentdatarollup-core'

export default defineConfig({
  plugins: [silentDataPlugin, hardhatIgnitionViemPlugin],
  solidity: '0.8.22',
  networks: {
    sdr: {
      type: 'http',
      url: configVariable('RPC_URL'),
      accounts: [configVariable('PRIVATE_KEY')],
      silentdata: {
        authSignatureType: SignatureType.Raw,
      },
    },
  },
})
