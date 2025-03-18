import {
  ChainId,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  isSignableContractCall,
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
  Wallet,
} from 'ethers'
import { SilentDataRollupProviderConfig } from './types'

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
  public signer: Signer
  private baseProvider: SilentDataRollupBase

  constructor(config: SilentDataRollupProviderConfig) {
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

    assertArgument(
      config.signer || config.privateKey,
      'signer or privateKey is mandatory',
      'config',
      config,
    )

    this.baseProvider = new SilentDataRollupBase(config)

    this.config = config
    this.config.authSignatureType =
      config.authSignatureType || SignatureType.Raw

    if (config.signer) {
      try {
        // try to connect the signer to the provider
        this.signer = config.signer.connect(this)
      } catch {
        // if connecting signer to provider fails, fallback to using the signer from the config
        this.signer = config.signer
      }
    } else {
      const wallet = new Wallet(config.privateKey!)
      this.signer = wallet.connect(this)
    }
  }

  async _send(
    payload: JsonRpcPayload | Array<JsonRpcPayload>,
  ): Promise<Array<JsonRpcResult>> {
    // Disable batch requests by setting batchMaxCount to 1
    // TODO: Implement support for batch requests in the future
    if (Array.isArray(payload)) {
      throw new Error('Batch requests are not currently supported')
    }

    // Set the from on eth_calls
    if (payload.method === 'eth_call' && Array.isArray(payload.params)) {
      const txParams = payload.params[0]
      if (typeof txParams === 'object' && txParams !== null) {
        txParams.from = await this.signer.getAddress()
      }
    }

    const request = this._getConnection()
    request.body = JSON.stringify(payload)
    request.setHeader('content-type', 'application/json')

    const requiresAuthHeaders =
      SIGN_RPC_METHODS.includes(payload.method) ||
      isSignableContractCall(
        payload,
        this.baseProvider.contractMethodsToSign,
        this.baseProvider.contract,
      )

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
            xEip712DelegateSignature,
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

  clone(): SilentDataRollupProvider {
    const clonedProvider = new SilentDataRollupProvider(this.config)
    return clonedProvider
  }
}
