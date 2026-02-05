import debug from 'debug'
import {
  calculateEventTypeHash,
  ChainId,
  DEBUG_NAMESPACE,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
  HEADER_FROM_BLOCK,
  HEADER_SIGNATURE,
  HEADER_SIGNATURE_TYPE,
  HEADER_SIGNER_SWC,
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
import { SilentDataRollupSigner } from './signer'
import { PrivateEventsFilter, SilentDataRollupProviderConfig } from './types'
import { validateTdxAttestation } from '@appliedblockchain/silentdatarollup-core'

const log = debug(DEBUG_NAMESPACE)

function isPromise<T = any>(value: any): value is Promise<T> {
  return value && typeof value.then === 'function'
}

function getNetwork(
  networkName?: NetworkName | string,
  chainId?: number,
): Network | undefined {
  // If chainId is provided, use it with whatever network name is given
  if (chainId) {
    return new Network(networkName ?? 'custom', chainId)
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

    this.baseProvider = new SilentDataRollupBase({
      ...config,
      smartWalletAddress: config.smartWalletAddress,
    })

    this.config = config
    this.config.authSignatureType =
      config.authSignatureType || SignatureType.Raw

    if (config.signer) {
      try {
        // try to connect the signer to the provider
        this.signer = config.signer.connect(this)
      } catch {
        // if connecting signer to provider fails, fallback to using SilentDataRollupSigner wrapper
        this.signer = new SilentDataRollupSigner(this, config.signer)
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

    // Don't fetch transaction details. For security reasons the RPC fails if we do
    if (
      ['eth_getBlockByNumber', 'eth_getBlockByHash'].includes(payload.method) &&
      Array.isArray(payload.params) &&
      payload.params.length > 1
    ) {
      payload.params[1] = false
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _isPrivateEvent, ...filterWithoutPrivateEvent } = filter
          payload.params[0] = filterWithoutPrivateEvent
        }
      }
    }

    if (!this._isNodeRuntime() || !this._isRegistryContractSet()) {
      return await this._sendWithoutAttestation(payload, isPrivateLogsRequest)
    }
    return await this._sendWithPinnedTlsAndAttest(payload, isPrivateLogsRequest)
  }

  private _isRegistryContractSet(): boolean {
    return (
      Boolean(this.config.l1RpcUrl) && Boolean(this.config.registryContract)
    )
  }

  private _isNodeRuntime(): boolean {
    return (
      typeof process !== 'undefined' &&
      typeof process.versions === 'object' &&
      typeof process.versions.node === 'string'
    )
  }

  /**
   * Get authentication headers if required for the given payload.
   * Returns null if no auth headers are needed.
   */
  private async _getAuthHeaders(
    payload: JsonRpcPayload,
    isPrivateLogsRequest: boolean,
  ): Promise<Record<string, string> | null> {
    const requiresAuthHeaders =
      isPrivateLogsRequest ||
      SIGN_RPC_METHODS.includes(payload.method) ||
      isSignableContractCall(payload, this.baseProvider.contracts) ||
      (this.config.alwaysSignEthCalls && payload.method === 'eth_call')

    if (!requiresAuthHeaders) {
      return null
    }

    const headers: Record<string, string> = {}

    // Add delegate headers if configured
    if (this.config.delegate) {
      const {
        [HEADER_DELEGATE]: xDelegate,
        [HEADER_DELEGATE_SIGNATURE]: xDelegateSignature,
        [HEADER_EIP712_DELEGATE_SIGNATURE]: xEip712DelegateSignature,
      } = await this.baseProvider.getDelegateHeaders(this)

      headers[HEADER_DELEGATE] = xDelegate
      if (xDelegateSignature) {
        headers[HEADER_DELEGATE_SIGNATURE] = xDelegateSignature
      }
      if (xEip712DelegateSignature) {
        headers[HEADER_EIP712_DELEGATE_SIGNATURE] = xEip712DelegateSignature
      }
    }

    // Add smart wallet header if configured
    if (this.config.smartWalletAddress) {
      log('Setting smart wallet header:', this.config.smartWalletAddress)
      headers[HEADER_SIGNER_SWC] = this.config.smartWalletAddress
    }

    // Get auth headers (signature, timestamp, etc.)
    const {
      [HEADER_TIMESTAMP]: xTimestamp,
      [HEADER_SIGNATURE]: xSignature,
      [HEADER_EIP712_SIGNATURE]: xEip712Signature,
      [HEADER_FROM_BLOCK]: xFromBlock,
    } = await this.baseProvider.getAuthHeaders(this, payload)

    headers[HEADER_TIMESTAMP] = xTimestamp
    if (xSignature) {
      headers[HEADER_SIGNATURE] = xSignature
    }
    if (xEip712Signature) {
      headers[HEADER_EIP712_SIGNATURE] = xEip712Signature
    }
    if (xFromBlock) {
      headers[HEADER_FROM_BLOCK] = xFromBlock
    }

    // Add signature type header
    const signatureType = this.config.authSignatureType ?? SignatureType.EIP191
    if (signatureType) {
      headers[HEADER_SIGNATURE_TYPE] = signatureType
    }

    return headers
  }

  private async _sendWithoutAttestation(
    payload: JsonRpcPayload,
    isPrivateLogsRequest: boolean,
  ): Promise<Array<JsonRpcResult>> {
    const request = this._getConnection()

    request.body = JSON.stringify(payload)
    request.setHeader('content-type', 'application/json')

    const authHeaders = await this._getAuthHeaders(
      payload,
      isPrivateLogsRequest,
    )
    if (authHeaders) {
      for (const [key, value] of Object.entries(authHeaders)) {
        request.setHeader(key, value)
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

  private async _sendWithPinnedTlsAndAttest(
    payload: JsonRpcPayload,
    isPrivateLogsRequest: boolean,
  ): Promise<Array<JsonRpcResult>> {
    const https = await import(/* webpackIgnore: true */ 'node:https')
    type TLSSocket = import('node:tls').TLSSocket
    const { URL } = await import(/* webpackIgnore: true */ 'node:url')

    const conn = this._getConnection()
    const rpcUrlStr = conn.url

    if (!rpcUrlStr) {
      throw new Error('Unable to determine rpcUrl for pinned TLS transport')
    }

    const rpcUrl = new URL(rpcUrlStr)

    let exporterKey: Buffer | null = null

    const doRequest = (
      method: 'GET' | 'POST',
      path: string,
      body?: Buffer,
      headers: Record<string, string> = {},
      forcedSocket?: TLSSocket,
    ): Promise<{ statusCode: number; body: Buffer; socket: TLSSocket }> =>
      new Promise((resolve, reject) => {
        const req = https.request(
          {
            protocol: rpcUrl.protocol,
            hostname: rpcUrl.hostname,
            port: rpcUrl.port ? Number(rpcUrl.port) : 443,
            path,
            method,
            headers,
            agent: false,
            createConnection: forcedSocket ? () => forcedSocket : undefined,
          },
          (res) => {
            const socket = res.socket as TLSSocket

            const DomainSeparator = 'CUSTOM-RPC ATTEST:'
            const DOMAIN_SEPARATOR = Buffer.from(DomainSeparator, 'utf8')

            exporterKey = (socket as any).exportKeyingMaterial(
              32,
              'tdx-attestation',
              DOMAIN_SEPARATOR,
            )

            const chunks: Buffer[] = []
            res.on('data', (d) =>
              chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)),
            )
            res.on('end', () =>
              resolve({
                statusCode: res.statusCode ?? 0,
                body: Buffer.concat(chunks),
                socket,
              }),
            )
          },
        )

        req.on('error', reject)
        if (body) {
          req.write(body)
        }
        req.end()
      })

    const attest = await doRequest('GET', '/tdx/attest', undefined, {
      connection: 'keep-alive',
    })
    if (attest.statusCode < 200 || attest.statusCode >= 300) {
      throw new Error(`/tdx/attest failed: HTTP ${attest.statusCode}`)
    }

    const isValid = await validateTdxAttestation(
      attest.body,
      exporterKey!,
      this.config.l1RpcUrl!,
      this.config.registryContract!,
    )
    if (!isValid) {
      throw new Error('TDX attestation validation failed')
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }
    const authHeaders = await this._getAuthHeaders(
      payload,
      isPrivateLogsRequest,
    )
    if (authHeaders) {
      Object.assign(headers, authHeaders)
    }

    const rpcBody = Buffer.from(JSON.stringify(payload))
    const rpc = await doRequest('POST', '/', rpcBody, headers, attest.socket)
    if (rpc.statusCode < 200 || rpc.statusCode >= 300) {
      throw new Error(`RPC POST / failed: HTTP ${rpc.statusCode}`)
    }

    let parsed: any = JSON.parse(rpc.body.toString('utf8'))
    if (!Array.isArray(parsed)) {
      parsed = [parsed]
    }
    return parsed as Array<JsonRpcResult>
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
