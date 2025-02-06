  import {
    ChainId,
    HEADER_DELEGATE,
    HEADER_DELEGATE_SIGNATURE,
    HEADER_EIP712_DELEGATE_SIGNATURE,
    HEADER_EIP712_SIGNATURE,
    HEADER_SIGNATURE,
    HEADER_TIMESTAMP,
    BaseConfig,
    NetworkName,
    SIGN_RPC_METHODS,
    SignatureType,
    SilentDataRollupBase,
  } from '@appliedblockchain/silentdatarollup-core'
  import {
    assertArgument,
    FetchRequest,
    JsonRpcApiProviderOptions,
    JsonRpcPayload,
    JsonRpcProvider,
    JsonRpcResult,
    Network,
    Signer,
  } from 'ethers'
import { toFunctionSelector } from 'viem'
import { Config } from 'wagmi'

type SilentDataProviderConfig = {
	/**
	 * The RPC URL
	 */
	rpcUrl: string

	delegate?: boolean

	chainId?: number

	signatureType?: SignatureType

	network?: NetworkName,

	methodsToSign?: string[]
}

export let SDProviderInstance: SilentDataRollupProvider

export interface SilentDataRollupProviderConfig extends BaseConfig {
  rpcUrl: string;
  network?: NetworkName;
  chainId?: number;
  privateKey?: string;
  signer?: {
    getAddress: () => Promise<string>
    signMessage: (message: string) => Promise<string>
  };
  options?: JsonRpcApiProviderOptions;
}

function getNetwork(name: NetworkName, chainId?: number): Network {
  switch (name) {
    case NetworkName.MAINNET:
      return new Network(name, chainId || ChainId.MAINNET)
    case NetworkName.TESTNET:
      return new Network(name, chainId || ChainId.TESTNET)
    default:
      assertArgument(false, 'unsupported network', 'network', name)
  }
}

const providerDefaultOptions: JsonRpcApiProviderOptions = {
  batchMaxCount: 1,
}

export class SilentDataRollupProvider extends JsonRpcProvider {
  private config: SilentDataRollupProviderConfig
  public wagmiConfig?: Config
  public signer?: {
    getAddress: () => Promise<string>
    signMessage: (message: string) => Promise<string>
  }
  public baseProvider: SilentDataRollupBase
  public methodsToSign: string[]

  constructor(config: SilentDataRollupProviderConfig & { methodsToSign?: string[] }) {
    if (!config.network) {
      config.network = NetworkName.MAINNET
    }

    assertArgument(config.rpcUrl, 'rpcUrl is mandatory', 'config', config)

    const network = getNetwork(config.network, config.chainId)

    const request = SilentDataRollupProvider.getRequest({
      rpcUrl: config.rpcUrl,
    })

    const combinedOptions = {
      ...providerDefaultOptions,
      ...config.options,
    }

    super(request, network, combinedOptions)

    this.methodsToSign = config.methodsToSign || []

    this.baseProvider = new SilentDataRollupBase(config)

    this.config = config
    this.config.authSignatureType =
      config.authSignatureType || SignatureType.Raw
    this.signer = config.signer as Signer
  }

  async _send(
    payload: JsonRpcPayload | Array<JsonRpcPayload>
  ): Promise<Array<JsonRpcResult>> {
    // Disable batch requests by setting batchMaxCount to 1
    // TODO: Implement support for batch requests in the future
    if (Array.isArray(payload)) {
      throw new Error('Batch requests are not currently supported')
    }

    // Set the from on eth_calls
    if (payload.method === 'eth_call' && Array.isArray(payload.params)) {
      const txParams = payload.params[0]
      if (typeof txParams === 'object' && txParams !== null && this.signer) {
        txParams.from = await this.signer.getAddress()
      }
    }

    const request = this._getConnection()
    request.body = JSON.stringify(payload)
    request.setHeader('content-type', 'application/json')

    const requiresAuthHeaders =
      SIGN_RPC_METHODS.includes(payload.method) ||
      this.isSignableContractCall(payload)

    if (requiresAuthHeaders) {
      if (this.config.delegate) {
        const {
          [HEADER_DELEGATE]: xDelegate,
          [HEADER_DELEGATE_SIGNATURE]: xDelegateSignature,
          [HEADER_EIP712_DELEGATE_SIGNATURE]: xEip712DelegateSignature,
        } = await this.baseProvider.getDelegateHeaders(this)

        request.setHeader(HEADER_DELEGATE, xDelegate)
        if (xDelegateSignature) {
          request.setHeader(HEADER_DELEGATE_SIGNATURE, xDelegateSignature)
        }
        if (xEip712DelegateSignature) {
          request.setHeader(
            HEADER_EIP712_DELEGATE_SIGNATURE,
            xEip712DelegateSignature
          )
        }
      }

      const {
        [HEADER_TIMESTAMP]: xTimestamp,
        [HEADER_SIGNATURE]: xSignature,
        [HEADER_EIP712_SIGNATURE]: xEip712Signature,
      } = await this.baseProvider.getAuthHeaders(this, payload)
      request.setHeader(HEADER_TIMESTAMP, xTimestamp)
      if (xSignature) {
        request.setHeader(HEADER_SIGNATURE, xSignature)
      }
      if (xEip712Signature) {
        request.setHeader(HEADER_EIP712_SIGNATURE, xEip712Signature)
      }
    }

    const response = await request.send()
    response.assertOk()

    let resp = response.bodyJson
    if (!Array.isArray(resp)) {
      resp = [resp]
    }

    return resp
  }

  static getRequest({ rpcUrl }: { rpcUrl: string }): FetchRequest {
    const request = new FetchRequest(rpcUrl)
    request.allowGzip = true

    return request
  }
  
  static configure({
    rpcUrl,
    chainId,
    signatureType,
    network,
    delegate,
    methodsToSign,
  }: SilentDataProviderConfig) {
    // Singleton instance
    if (!SDProviderInstance) {
      SDProviderInstance = new SilentDataRollupProvider({
        rpcUrl: rpcUrl,
        chainId: chainId,
        delegate: delegate,
        authSignatureType: signatureType || SignatureType.Raw,
        network: network || NetworkName.TESTNET,
        methodsToSign
      })
    }

    return SDProviderInstance
  }

  clone(): SilentDataRollupProvider {
    const clonedProvider = new SilentDataRollupProvider(this.config)
    return clonedProvider
  }

  isSignableContractCall(payload: Pick<JsonRpcPayload, 'method' | 'params'>): boolean {
    // Return false if no methods are to be signed
    if (!this.methodsToSign.length) {
      return false
    }

    // Check if the method is eth_call
    if (payload.method !== 'eth_call') {
      return false
    }

    // Check invalid parameters
    const params = payload.params as any[]
    if (!params || params.length === 0 || typeof params[0] !== 'object') {
      return false
    }

    // Get the method selector
    const methodSelector = `0x${params[0].data.slice(2, 10)}`
    
    // Check if the method selector is in the list of methods to sign
    return this.methodsToSign.some((methodSignature) => {
      return methodSelector.startsWith(toFunctionSelector(methodSignature))
    })
  }

  /**
   * Resets the session headers. This is used to clear the session headers when wallet is disconnected.
   */
  resetSession() {
    // @ts-ignore
    this.baseProvider.cachedDelegateHeaders = null
    // @ts-ignore
    this.baseProvider.cachedHeadersExpiry = 0
  }
}
