import {
  calculateEventTypeHash,
  ChainId,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  isSignableContractCall,
  NetworkName,
  PRIVATE_EVENT_SIGNATURE_HASH,
  SIGN_RPC_METHODS,
  SignatureType,
  SilentDataRollupBase,
} from '@appliedblockchain/silentdatarollup-core'
import {
  assertArgument,
  FetchRequest,
  Filter,
  FilterByBlockHash,
  JsonRpcApiProviderOptions,
  JsonRpcPayload,
  JsonRpcProvider,
  JsonRpcResult,
  Log,
  LogParams,
  Network,
  resolveProperties,
  Signer,
  Wallet,
} from 'ethers'
import { PrivateEventsFilter, SilentDataRollupProviderConfig } from './types'

function isPromise<T = any>(value: any): value is Promise<T> {
  return value && typeof value.then === 'function'
}

function getNetwork(networkName?: NetworkName | string, chainId?: number): Network | undefined {
  // If chainId is provided, use it with whatever network name is given
  if (chainId) {
    return new Network(networkName ?? 'unknown', chainId)
  }
  
  // If no chainId, check if it's a predefined network and use default chainId
  if (networkName === NetworkName.MAINNET) {
    return new Network(networkName, ChainId.MAINNET)
  } else if (networkName === NetworkName.TESTNET) {
    return new Network(networkName, ChainId.TESTNET)
  }
  
  // No chainId and not a predefined network - let ethers auto-detect
  return undefined
}

const providerDefaultOptions: JsonRpcApiProviderOptions = {
  batchMaxCount: 1,
}

export class SilentDataRollupProvider extends JsonRpcProvider {
  private config: SilentDataRollupProviderConfig
  public signer: Signer
  private baseProvider: SilentDataRollupBase

  constructor(config: SilentDataRollupProviderConfig) {
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
    const isEthCallOrEstimateGas =
      payload.method === 'eth_call' || payload.method === 'eth_estimateGas'
    if (isEthCallOrEstimateGas && Array.isArray(payload.params)) {
      const txParams = payload.params[0]
      if (typeof txParams === 'object' && txParams !== null) {
        txParams.from = await this.signer.getAddress()
      }
    }

    // Check if this is a private logs request
    let isPrivateLogsRequest = false

    // Check if params[0] contains our flag (_isPrivateEvent)
    if (
      payload.method === 'eth_getLogs' &&
      Array.isArray(payload.params) &&
      payload.params.length > 0
    ) {
      const filter = payload.params[0]
      if (filter && typeof filter === 'object' && '_isPrivateEvent' in filter) {
        // This is a request from getAllLogs or getPrivateLogs
        isPrivateLogsRequest = !!filter._isPrivateEvent

        // Now clone the filter without the custom property to avoid sending it to the RPC
        if (isPrivateLogsRequest) {
          const { _isPrivateEvent, ...filterCopy } = filter
          payload.params[0] = filterCopy
        }
      }
    }

    const request = this._getConnection()
    request.body = JSON.stringify(payload)
    request.setHeader('content-type', 'application/json')

    const requiresAuthHeaders =
      isPrivateLogsRequest ||
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

  /**
   * Helper method to configure a filter for private events
   * @param filter - The original filter
   * @param forcePrivateOnly - Whether to force filtering for only PrivateEvents
   * @returns The configured filter with proper topics
   */
  private configurePrivateEventsFilter(
    filter: PrivateEventsFilter,
    forcePrivateOnly = false,
  ): Filter {
    // Create a copy of the filter with the authentication flag
    const privateFilter: PrivateEventsFilter = {
      ...filter,
      _isPrivateEvent: true,
    }

    // Initialize topics array if it doesn't exist
    privateFilter.topics = privateFilter.topics || []

    // If we're forcing private-only mode or eventSignature is provided
    if (forcePrivateOnly || privateFilter.eventSignature) {
      // For private-only mode, always set topic[0] to the PrivateEvent signature
      if (forcePrivateOnly) {
        privateFilter.topics = [
          PRIVATE_EVENT_SIGNATURE_HASH, // Only match PrivateEvent
          ...privateFilter.topics.slice(1), // Preserve any other topic filters
        ]
      }

      // If eventSignature is provided, set up topic[1] for event type filtering
      if (privateFilter.eventSignature) {
        // Calculate the hash of the event signature
        const eventTypeHash = calculateEventTypeHash(
          privateFilter.eventSignature,
        )

        // If in private-only mode, topic[0] is already set
        // Otherwise, set both topic[0] and topic[1]
        if (forcePrivateOnly) {
          // Just set topic[1] to the event type hash
          privateFilter.topics[1] = eventTypeHash
        } else {
          // Set up both topics for filtering
          privateFilter.topics = [
            PRIVATE_EVENT_SIGNATURE_HASH, // Only match PrivateEvent
            eventTypeHash, // Only match the specific event type
            ...(privateFilter.topics || []).slice(2), // Preserve any other topics
          ]
        }

        // Remove the eventSignature property before passing to getLogs
        delete privateFilter.eventSignature
      }
    }

    return privateFilter
  }

  /**
   * Gets logs for private events, including authentication headers
   * @param filter - The filter parameters for logs
   * @returns Array of logs matching the filter
   */
  async getAllLogs(filter: PrivateEventsFilter = {}): Promise<Array<Log>> {
    // Configure the filter with proper authentication and topics
    const privateFilter = this.configurePrivateEventsFilter(filter, false)

    // Call getLogs with our modified filter
    return await this.getLogs(privateFilter)
  }

  /**
   * Gets only private events (PrivateEvent logs), including authentication headers
   * @param filter - The filter parameters for logs
   * @returns Array of logs matching the filter, containing only PrivateEvent logs
   */
  async getPrivateLogs(filter: PrivateEventsFilter = {}): Promise<Log[]> {
    // Configure the filter for private-only mode
    const privateFilter = this.configurePrivateEventsFilter(filter, true)

    // Call getLogs with our modified filter
    return await this.getLogs(privateFilter)
  }

  /**
   * Override of ethers' getLogs method that preserves our custom _isPrivateEvent property
   *
   * IMPORTANT: This method mimics the behavior of ethers' original getLogs implementation
   * but adds a crucial step to preserve the _isPrivateEvent flag. We need this because:
   *
   * 1. Ethers' _getFilter method sanitizes filter objects, removing any non-standard properties
   * 2. Our _isPrivateEvent flag would be stripped by this sanitization
   * 3. We need the flag to reach the _send method to trigger the addition of auth headers
   *
   * The approach here is to run the normal filter processing, then re-attach our flag as a
   * non-enumerable property to avoid JSON serialization issues. This allows the flag to
   * survive until _send where we check for it to determine if auth headers are needed.
   *
   * @param _filter - The filter with our potential _isPrivateEvent property
   * @returns Array of logs matching the filter
   */
  async getLogs(
    _filter: PrivateEventsFilter | FilterByBlockHash,
  ): Promise<Log[]> {
    let filter = this._getFilter(_filter)
    if (isPromise(filter)) {
      filter = await filter
    }

    // Type check before accessing _isPrivateEvent
    if (
      typeof _filter === 'object' &&
      '_isPrivateEvent' in _filter &&
      _filter._isPrivateEvent
    ) {
      // Use a non-enumerable property to avoid JSON serialization issues
      Object.defineProperty(filter, '_isPrivateEvent', {
        value: true,
        enumerable: false,
      })
    }

    const { network, params } = await resolveProperties({
      network: this.getNetwork(),
      params: this._perform({ method: 'getLogs', filter }),
    })

    return params.map((p: LogParams) => this._wrapLog(p, network))
  }
}
