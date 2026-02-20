import './type-extensions'
import type { HardhatPlugin } from 'hardhat/types/plugins'

const plugin: HardhatPlugin = {
  id: 'silentdatarollup-hardhat3-plugin',
  hookHandlers: {
    config: () => import('./hooks/config'),
    network: () => import('./hooks/network'),
  },
}

export default plugin

export type { SilentdataNetworkConfig } from './types'
