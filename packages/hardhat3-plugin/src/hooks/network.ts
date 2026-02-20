import { SignatureType } from '@appliedblockchain/silentdatarollup-core'
import { Wallet } from 'ethers'
import debug from 'debug'
import { makeAuthenticatedRequest, type JsonRpcRequest } from '../utils'
import { DEBUG_NAMESPACE, SIGN_RPC_METHODS } from '../constants'
import type { HookContext, NetworkHooks } from 'hardhat/types/hooks'
import type { ChainType, NetworkConnection } from 'hardhat/types/network'
import type { SilentdataNetworkConfig } from '../types'

const log = debug(DEBUG_NAMESPACE)

// Cache for network chain IDs
const chainIdCache = new Map<string, string>()

// Store silentdata config per connection ID (since connection objects may not persist)
interface ConnectionData {
  config: SilentdataNetworkConfig
  signer: Wallet
  url: string
}
const connectionDataCache = new Map<number, ConnectionData>()

export default async (): Promise<Partial<NetworkHooks>> => {
  const handlers: Partial<NetworkHooks> = {
    /**
     * Hook called when a new network connection is created.
     * We use this to store the silentdata config on the connection.
     */
    async newConnection<ChainTypeT extends ChainType | string>(
      context: HookContext,
      next: (
        nextContext: HookContext,
      ) => Promise<NetworkConnection<ChainTypeT>>,
    ): Promise<NetworkConnection<ChainTypeT>> {
      const connection = await next(context)

      // Get the network config from the resolved config
      const networkConfig = context.config.networks[connection.networkName]

      if ('silentdata' in networkConfig && networkConfig.silentdata) {
        log(
          'SilentData configuration found for network: %s',
          connection.networkName,
        )

        // Validate: must be an HTTP network with a URL
        if (!('url' in networkConfig)) {
          throw new Error('Network config is not an HTTP network')
        }

        // Validate: accounts must be present
        if (!('accounts' in networkConfig)) {
          throw new Error('No accounts found in network config')
        }

        const accounts = networkConfig.accounts
        if (!Array.isArray(accounts) || accounts.length === 0) {
          throw new Error('No accounts found in network config')
        }

        // Validate: only single account is supported
        if (accounts.length > 1) {
          throw new Error('Multiple accounts not supported')
        }

        const account = accounts[0]

        // Get the private key from the account
        let privateKey: string
        try {
          privateKey = await account.getHexString()
        } catch {
          throw new Error('Failed to get private key from account')
        }
        if (!privateKey) {
          throw new Error('Account private key is not defined')
        }

        const signer = new Wallet(privateKey)
        log(
          'SilentData signer configured for network: %s',
          connection.networkName,
        )

        // Get the RPC URL
        const url = networkConfig.url
        let rpcUrl: string
        try {
          rpcUrl = await url.getUrl()
        } catch {
          throw new Error('Failed to get RPC URL')
        }
        if (!rpcUrl) {
          throw new Error('RPC URL is not defined')
        }

        const silentdataConfig: SilentdataNetworkConfig = {
          ...networkConfig.silentdata,
          authSignatureType:
            networkConfig.silentdata.authSignatureType ?? SignatureType.Raw,
        }

        // Store in cache by connection ID
        connectionDataCache.set(connection.id, {
          config: silentdataConfig,
          signer,
          url: rpcUrl,
        })
        log('Cached connection data for connection ID: %d', connection.id)
      }

      return connection
    },

    /**
     * Hook called for every JSON-RPC request.
     * We intercept requests that require authentication and make the HTTP
     * request ourselves with the auth headers.
     */
    async onRequest(context, networkConnection, jsonRpcRequest, next) {
      // Get cached connection data
      const connectionData = connectionDataCache.get(networkConnection.id)

      // If no silentdata config, pass through
      if (!connectionData) {
        return next(context, networkConnection, jsonRpcRequest)
      }

      const { config: silentdataConfig, signer, url: rpcUrl } = connectionData

      const requiresAuthHeaders = SIGN_RPC_METHODS.includes(
        jsonRpcRequest.method,
      )

      if (!requiresAuthHeaders) {
        log(
          'Forwarding request without auth headers: %s',
          jsonRpcRequest.method,
        )
        return next(context, networkConnection, jsonRpcRequest)
      }

      log('Adding auth headers for method: %s', jsonRpcRequest.method)

      // Get cached chain ID or fetch it
      let chainId = chainIdCache.get(networkConnection.networkName)
      if (!chainId) {
        const chainIdHex = (await networkConnection.provider.request({
          method: 'eth_chainId',
        })) as string
        chainId = Number(chainIdHex).toString()
        chainIdCache.set(networkConnection.networkName, chainId)
      }

      const rpcRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: jsonRpcRequest.method,
        params: (jsonRpcRequest.params ?? []) as unknown[],
        id: jsonRpcRequest.id ?? 0,
      }

      const result = await makeAuthenticatedRequest(
        rpcUrl,
        rpcRequest,
        signer,
        chainId,
        silentdataConfig.authSignatureType!,
      )

      return { jsonrpc: '2.0' as const, id: rpcRequest.id, result }
    },
  }

  return handlers
}
