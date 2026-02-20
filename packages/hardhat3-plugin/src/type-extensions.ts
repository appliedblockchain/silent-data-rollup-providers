import 'hardhat/types/config'
import type { SilentdataNetworkConfig } from './types'

declare module 'hardhat/types/config' {
  interface HttpNetworkUserConfig {
    silentdata?: SilentdataNetworkConfig
  }

  interface HttpNetworkConfig {
    silentdata?: SilentdataNetworkConfig
  }
}
