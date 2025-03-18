import './type-extensions'
import '@fireblocks/hardhat-fireblocks'
import debug from 'debug'
import { extendEnvironment } from 'hardhat/config'
import { DEBUG_NAMESPACE } from './constants'
import { SilentDataFireblocksSigner } from './provider'

const log = debug(DEBUG_NAMESPACE)

extendEnvironment((hre) => {
  const networkConfig = hre.network.config as any

  if (!networkConfig.silentdata) {
    log('SilentData configuration not found. Returning the original provider.')
    return
  }

  if (!networkConfig.fireblocks) {
    log('Fireblocks configuration not found. Returning the original provider.')
    return
  }

  log('SilentData and Fireblocks configuration found. Extending provider...')

  const wrappedProvider = new SilentDataFireblocksSigner(
    hre.network.provider,
    networkConfig.silentdata,
  )
  log('Wrapped provider created')
  hre.network.provider = wrappedProvider
})
