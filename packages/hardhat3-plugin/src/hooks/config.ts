import { SignatureType } from '@appliedblockchain/silentdatarollup-core'
import type {
  HardhatUserConfig,
  HardhatConfig,
  HttpNetworkUserConfig,
} from 'hardhat/types/config'
import type { ConfigHooks } from 'hardhat/types/hooks'
import type { SilentdataNetworkConfig } from '../types'

export default async (): Promise<Partial<ConfigHooks>> => {
  const handlers: Partial<ConfigHooks> = {
    /**
     * Resolve the user config to add silentdata to the resolved config.
     * This is called during config resolution to transform user config into resolved config.
     */
    resolveUserConfig: async (
      userConfig: HardhatUserConfig,
      resolveConfigurationVariable,
      next,
    ): Promise<HardhatConfig> => {
      // First, let the default resolution happen
      const resolvedConfig = await next(
        userConfig,
        resolveConfigurationVariable,
      )

      // Now copy over silentdata config from user config to resolved config
      if (userConfig.networks) {
        for (const [networkName, networkUserConfig] of Object.entries(
          userConfig.networks,
        )) {
          if (
            networkUserConfig &&
            'silentdata' in networkUserConfig &&
            networkUserConfig.silentdata
          ) {
            const httpNetworkConfig = networkUserConfig as HttpNetworkUserConfig
            const resolvedNetwork = resolvedConfig.networks[networkName]

            if (resolvedNetwork) {
              const silentdataConfig: SilentdataNetworkConfig = {
                ...httpNetworkConfig.silentdata,
                authSignatureType:
                  httpNetworkConfig.silentdata?.authSignatureType ??
                  SignatureType.Raw,
              }

              // Add silentdata to the resolved config
              ;(
                resolvedNetwork as typeof resolvedNetwork & {
                  silentdata: SilentdataNetworkConfig
                }
              ).silentdata = silentdataConfig
            }
          }
        }
      }

      return resolvedConfig
    },
  }

  return handlers
}
