import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import {
  DEBUG_NAMESPACE,
  getAuthHeaders,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  SignatureType,
} from '@appliedblockchain/silentdatarollup-core'
import debug from 'debug'
import { ProviderWrapper } from 'hardhat/plugins'
import { RequestArguments } from 'hardhat/types'
import { SIGN_RPC_METHODS } from './constants'
import { SilentdataNetworkConfig } from './types'

const log = debug(DEBUG_NAMESPACE)

export class HardhatSilentDataRollupProvider extends ProviderWrapper {
  public signer: HardhatEthersSigner
  private config: SilentdataNetworkConfig
  private _cachedNetwork: any = null

  constructor(
    signer: any,
    protected readonly _wrappedProvider: any,
    config: SilentdataNetworkConfig,
  ) {
    super(_wrappedProvider)
    this.signer = signer
    this.config = {
      ...config,
      authSignatureType: config?.authSignatureType ?? SignatureType.Raw,
    }
    log('HardhatSilentDataRollupProvider initialized')
  }

  public async request(args: RequestArguments) {
    log('Request: %s', args)

    const requiresAuthHeaders = SIGN_RPC_METHODS.includes(args.method)

    if (requiresAuthHeaders) {
      log('Requesting auth headers for method: %s', args.method)
      // Clone the wrapped provider
      const clonedProvider = this.cloneWrappedProvider()

      const rpcRequest = clonedProvider._getJsonRpcRequest(
        args.method,
        args.params,
      )

      clonedProvider._extraHeaders = await this.getAuthHeaders(rpcRequest)

      // Use the cloned provider for this request
      return clonedProvider.request(args)
    }

    log('Forwarding request to wrapped provider')
    return this._wrappedProvider.request(args)
  }

  /**
   * Creates a clone of the wrapped provider with a modified _getJsonRpcRequest method.
   *
   * This method is necessary due to the way the wrapped provider handles headers.
   * The original provider uses a shared _extraHeaders property, which can lead to race conditions
   * in concurrent calls, potentially resulting in requests with incorrect headers.
   *
   * By cloning the provider and assigning a unique ID to each request, we ensure that:
   * 1. Each request uses its own set of headers
   * 2. Concurrent calls don't interfere with each other's header information
   *
   * This approach effectively prevents race conditions and ensures the integrity of each request's headers.
   */
  public cloneWrappedProvider() {
    const clonedProvider = Object.create(
      Object.getPrototypeOf(this._wrappedProvider),
      Object.getOwnPropertyDescriptors(this._wrappedProvider),
    )

    const payloadId = Math.floor(Math.random() * 10000000000)

    clonedProvider._getJsonRpcRequest = (
      method: string,
      params: any[] = [],
    ) => {
      return {
        jsonrpc: '2.0',
        method,
        params,
        id: payloadId,
      }
    }

    return clonedProvider
  }

  private async getAuthHeaders(request: any): Promise<{
    [HEADER_TIMESTAMP]: string
    [HEADER_SIGNATURE]?: string
    [HEADER_EIP712_SIGNATURE]?: string
  }> {
    log('Getting auth headers for request', JSON.stringify(request, null, 2))
    const chainId = await this.getCachedNetwork()
    const headers = await getAuthHeaders(
      this.signer,
      request,
      chainId,
      this.config.authSignatureType!,
    )
    log('Auth headers generated successfully', headers)
    return headers
  }

  /**
   * Get cached network with simple caching
   * @returns Promise<Network> - The cached or freshly fetched network
   */
  private async getCachedNetwork(): Promise<any> {
    if (!this._cachedNetwork) {
      const clonedProvider = this.cloneWrappedProvider()
      const chainIdHex = await clonedProvider.request({
        method: 'eth_chainId',
        params: [],
      })
      this._cachedNetwork = Number(chainIdHex).toString()
    }
    return this._cachedNetwork
  }
}
