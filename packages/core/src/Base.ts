import debug from 'debug'
import {
  Contract,
  getBytes,
  JsonRpcPayload,
  keccak256,
  Signer,
  toUtf8Bytes,
  TypedDataDomain,
  TypedDataEncoder,
  TypedDataField,
} from 'ethers'
import {
  DEBUG_NAMESPACE,
  DEFAULT_DELEGATE_EXPIRES,
  DEFAULT_USER_OPERATION_RECEIPT_LOOKUP_RANGE,
  DELEGATE_EXPIRATION_THRESHOLD_BUFFER,
  delegateEIP721Types,
  eip721Domain,
  ENTRYPOINT_ADDRESS,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
  HEADER_FROM_BLOCK,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  USER_OPERATION_EVENT_HASH,
} from './constants'
import { PRIVATE_EVENT_SIGNATURE_HASH } from './privateEvents'
import {
  AuthHeaders,
  AuthSignatureMessage,
  BaseConfig,
  ContractInfo,
  DelegateConfig,
  DelegateHeaders,
  DelegateSignerMessage,
  SignatureType,
} from './types'
import {
  defaultGetDelegate,
  getAuthEIP721Types,
  prepareTypedDataPayload,
} from './utils'

const log = debug(DEBUG_NAMESPACE)

export class SilentDataRollupBase {
  public config: BaseConfig
  private delegateConfig: DelegateConfig | null
  private currentDelegateSigner: Signer | null = null
  private delegateSignerExpires: number = 0
  private cachedDelegateHeaders: DelegateHeaders | null = null
  private cachedHeadersExpiry: number = 0
  private delegateHeadersPromise: Promise<DelegateHeaders> | null = null
  public contracts: ContractInfo[] = []
  private _cachedNetwork: any = null

  constructor(config: BaseConfig) {
    this.config = {
      ...config,
      authSignatureType: config.authSignatureType ?? SignatureType.EIP191,
    }

    this.delegateConfig = this.resolveDelegateConfig(config)
    log(
      'SilentDataRollupBase initialized with config:',
      JSON.stringify(config, null, 2),
    )
  }

  private resolveDelegateConfig(config: BaseConfig): DelegateConfig | null {
    if (config.delegate === true) {
      return {
        getDelegate: defaultGetDelegate,
        expires: DEFAULT_DELEGATE_EXPIRES,
      }
    } else if (typeof config.delegate === 'object') {
      return {
        getDelegate: config.delegate.getDelegate ?? defaultGetDelegate,
        expires: config.delegate.expires ?? DEFAULT_DELEGATE_EXPIRES,
      }
    }

    return null
  }

  /**
   * Get cached network with simple caching
   * @param provider - The provider to get the network from
   * @returns Promise<Network> - The cached or freshly fetched network
   */
  public async getCachedNetwork(provider: any): Promise<any> {
    if (!this._cachedNetwork) {
      this._cachedNetwork = await provider.getNetwork()
      log('Network cached:', this._cachedNetwork)
    }
    return this._cachedNetwork
  }

  public async getDelegateSigner(provider: any): Promise<Signer | null> {
    if (!this.delegateConfig) {
      log('getDelegateSigner: No delegate config, returning null')
      return null
    }
    const now = Math.floor(Date.now() / 1000)
    log('getDelegateSigner: Current time:', now)

    const isDelegateSignerValid =
      this.currentDelegateSigner &&
      this.delegateSignerExpires - DELEGATE_EXPIRATION_THRESHOLD_BUFFER > now
    if (isDelegateSignerValid) {
      log(
        'getDelegateSigner: Returning existing delegate signer, expires in:',
        this.delegateSignerExpires - now,
        'seconds',
      )
      return this.currentDelegateSigner
    } else {
      log('getDelegateSigner: Getting new delegate signer')
      try {
        const newSigner = await this.delegateConfig.getDelegate(provider)
        this.currentDelegateSigner = newSigner
        this.delegateSignerExpires = now + this.delegateConfig.expires
        log(
          'getDelegateSigner: New delegate signer set, expires in:',
          this.delegateConfig.expires,
          'seconds',
        )
        return newSigner
      } catch (error) {
        log('getDelegateSigner: Error getting delegate signer:', error)
        throw new Error('Failed to get delegate signer')
      }
    }
  }

  public async getDelegateSignerMessage(
    provider: any,
  ): Promise<DelegateSignerMessage | null> {
    if (!this.delegateConfig) {
      log('No delegate config, returning null')
      return null
    }

    const delegateSigner = await this.getDelegateSigner(provider)
    if (!delegateSigner) {
      log('Failed to get delegate signer, returning null')
      return null
    }

    return {
      expires: new Date(this.delegateSignerExpires * 1000).toISOString(),
      ephemeralAddress: await delegateSigner.getAddress(),
    }
  }

  /**
   * Signs a raw delegate header message.
   * This method can be overridden by extending classes to customize the signing process.
   * The signer implementation decides whether to add EIP-191 prefix or not.
   * @param provider - The provider used for signing
   * @param message - The delegate signer message to be signed
   * @param isSWC - Whether signing for smart wallet contract (EIP-1271)
   * @returns A promise that resolves to the signature string
   */
  protected async signDelegateHeader(
    provider: any,
    message: string,
    isSWC?: boolean,
  ): Promise<string> {
    log('signDelegateHeader: Signing delegate header', message)

    let bytesToSign: Uint8Array

    // For SWC, sign the hash bytes
    if (isSWC) {
      const messageHash = keccak256(toUtf8Bytes(message))
      bytesToSign = getBytes(messageHash)
      log('Signing hash bytes for SWC', messageHash)
    } else {
      // For EOA, sign the message bytes
      bytesToSign = toUtf8Bytes(message)
      log('Signing message bytes for EOA', message)
    }

    // Always pass bytes to signMessage
    // The signer implementation decides whether to add EIP-191 or not
    const signature = await provider.signer.signMessage(bytesToSign)
    log('signDelegateHeader: Signature generated:', signature)
    return signature
  }

  /**
   * Signs a typed delegate header message.
   * This method can be overridden by extending classes to customize the signing process.
   * @param provider - The provider used for signing
   * @param chainId - The chain ID
   * @param message - The delegate signer message to be signed
   * @param isSWC - Whether signing for smart wallet contract (EIP-1271)
   * @returns A promise that resolves to the signature string
   */
  protected async signTypedDelegateHeader(
    provider: any,
    chainId: string,
    message: DelegateSignerMessage,
    isSWC?: boolean,
  ): Promise<string> {
    log('signTypedDelegateHeader: Signing typed delegate header')
    log(
      'signTypedDelegateHeader: Typed message:',
      JSON.stringify(message, null, 2),
    )

    const domain = { ...eip721Domain, chainId }

    // For SWC, hash the typed data and sign the hash
    if (isSWC) {
      const messageHash = TypedDataEncoder.hash(
        domain,
        delegateEIP721Types,
        message,
      )
      const hashBytes = getBytes(messageHash)
      const signature = await provider.signer.signMessage(hashBytes)
      log('signTypedDelegateHeader: Typed SWC signature generated:', signature)
      return signature
    }

    // For EOA, sign typed data normally
    const signature = await provider.signer.signTypedData(
      domain,
      delegateEIP721Types,
      message,
    )

    log('signTypedDelegateHeader: Signature generated:', signature)
    return signature
  }

  /**
   * IMPORTANT: Return the cached promise (currentPromise), not the resolved value.
   * This ensures multiple concurrent callers share the same in-flight request,
   * preventing redundant API calls.
   */
  public async getDelegateHeaders(provider: any): Promise<DelegateHeaders> {
    log('Getting delegate headers')

    if (!this.delegateHeadersPromise) {
      this.delegateHeadersPromise = this.generateDelegateHeaders(provider)
    }

    const currentPromise = this.delegateHeadersPromise
    try {
      const delegateHeaders = await currentPromise
      log('Delegate headers:', JSON.stringify(delegateHeaders, null, 2))
      return currentPromise
    } catch (error) {
      log('Error getting delegate headers:', error)
      throw new Error('Failed to get delegate headers')
    } finally {
      if (this.delegateHeadersPromise === currentPromise) {
        this.delegateHeadersPromise = null
      }
    }
  }

  public async generateDelegateHeaders(
    provider: any,
  ): Promise<DelegateHeaders> {
    const now = Math.floor(Date.now() / 1000)
    const signatureType = this.config.authSignatureType
    const isCachedHeadersValid =
      this.cachedDelegateHeaders &&
      this.cachedHeadersExpiry - DELEGATE_EXPIRATION_THRESHOLD_BUFFER > now

    if (isCachedHeadersValid) {
      log('Returning cached delegate headers')
      return this.cachedDelegateHeaders as DelegateHeaders
    }

    try {
      const delegateSignerMessage =
        await this.getDelegateSignerMessage(provider)
      if (!delegateSignerMessage) {
        throw new Error('Failed to get delegate signer message')
      }

      const delegateSigner = await this.getDelegateSigner(provider)
      if (!delegateSigner) {
        throw new Error('Failed to get delegate signer')
      }

      const headers: Partial<DelegateHeaders> = {
        [HEADER_DELEGATE]: JSON.stringify(delegateSignerMessage),
      }

      const chainId = (await this.getCachedNetwork(provider)).chainId.toString()
      const isSWC = !!this.config.smartWalletAddress

      switch (signatureType) {
        case SignatureType.EIP191:
        case SignatureType.Raw: {
          log('Generating delegate signature')
          const delegateMessageToSign =
            chainId + JSON.stringify(delegateSignerMessage)
          headers[HEADER_DELEGATE_SIGNATURE] = await this.signDelegateHeader(
            provider,
            delegateMessageToSign,
            isSWC,
          )
          break
        }
        case SignatureType.EIP712:
          log('Generating delegate EIP712 signature')
          headers[HEADER_EIP712_DELEGATE_SIGNATURE] =
            await this.signTypedDelegateHeader(
              provider,
              chainId,
              delegateSignerMessage,
              isSWC,
            )
          break
        default:
          throw new Error(`Unsupported signature type: ${signatureType}`)
      }

      this.cachedDelegateHeaders = headers as DelegateHeaders
      this.cachedHeadersExpiry =
        new Date(delegateSignerMessage.expires).getTime() / 1000

      return this.cachedDelegateHeaders
    } catch (error) {
      log('Error getting delegate headers:', error)
      throw new Error('Failed to get delegate headers')
    }
  }

  public async getAuthHeaders(
    provider: any,
    payload: JsonRpcPayload | JsonRpcPayload[],
  ): Promise<AuthHeaders> {
    log('Getting auth headers', JSON.stringify(payload, null, 2))
    const xTimestamp = new Date().toISOString()
    const headers: AuthHeaders = {
      [HEADER_TIMESTAMP]: xTimestamp,
    }
    const chainId = (await this.getCachedNetwork(provider)).chainId.toString()
    const signatureType = this.config.authSignatureType ?? SignatureType.EIP191
    const isSWC = !!this.config.smartWalletAddress

    // Special handling for eth_getUserOperationReceipt: sign with custom eth_getLogs payload
    // Note: We don't handle batched requests (arrays) as the custom providers never do batch requests
    let payloadToSign = payload
    const isGetUserOperationReceipt =
      !Array.isArray(payload) &&
      payload.method === 'eth_getUserOperationReceipt'

    if (isGetUserOperationReceipt) {
      log(
        'Detected eth_getUserOperationReceipt, building custom eth_getLogs payload for signing',
      )

      // Get the current block number and calculate fromBlock
      // This value is mandatory and must be within the valid range
      // or the bundler will reject the request
      let fromBlock: bigint
      try {
        fromBlock = await this.getFromBlockForUserOperationReceipt(provider)
        headers[HEADER_FROM_BLOCK] = fromBlock.toString()
        log(`Added ${HEADER_FROM_BLOCK} header:`, fromBlock.toString())
      } catch (error) {
        log(
          'Error calculating fromBlock for eth_getUserOperationReceipt:',
          error,
        )
        throw new Error(
          'Failed to calculate fromBlock for eth_getUserOperationReceipt',
        )
      }

      payloadToSign = this.buildGetUserOperationReceiptSigningPayload(
        payload,
        fromBlock,
      )
      log(
        'Using custom eth_getLogs payload for signing:',
        JSON.stringify(payloadToSign, null, 2),
      )
    }

    switch (signatureType) {
      case SignatureType.EIP191:
      case SignatureType.Raw:
        log('Generating auth header signature')
        headers[HEADER_SIGNATURE] = await this.signAuthHeader(
          provider,
          payloadToSign,
          xTimestamp,
          chainId,
          isSWC,
        )
        break
      case SignatureType.EIP712:
        log('Generating auth header typed signature')
        headers[HEADER_EIP712_SIGNATURE] = await this.signTypedAuthHeader(
          provider,
          payloadToSign,
          xTimestamp,
          chainId,
          isSWC,
        )
        break
      default:
        throw new Error(`Unsupported signature type: ${signatureType}`)
    }

    log('Auth headers:', JSON.stringify(headers, null, 2))
    return headers
  }

  /**
   * Signs auth header.
   */
  public async signAuthHeader(
    provider: any,
    payload: JsonRpcPayload | JsonRpcPayload[],
    timestamp: string,
    chainId: string,
    isSWC?: boolean,
  ): Promise<string> {
    const xMessage = this.prepareMessage(chainId, payload, timestamp)
    const delegateSigner = await this.getDelegateSigner(this)
    const signer = delegateSigner ?? provider.signer
    const usingDelegate = !!delegateSigner

    let bytesToSign: Uint8Array

    // For SWC, sign the hash bytes
    if (isSWC && !usingDelegate) {
      const messageHash = keccak256(toUtf8Bytes(xMessage))
      bytesToSign = getBytes(messageHash)
      log('Signing hash bytes for SWC')
    } else {
      // For EOA, sign the message bytes
      bytesToSign = toUtf8Bytes(xMessage)
      log('Signing message bytes for EOA')
    }

    // Always pass bytes to signMessage
    // The signer implementation decides whether to add EIP-191 or not
    const signature = await signer.signMessage(bytesToSign)
    log('Message signed raw. Signature:', signature)
    return signature
  }

  /**
   * Signs auth header using typed data signature.
   */
  public async signTypedAuthHeader(
    provider: any,
    payload: JsonRpcPayload | JsonRpcPayload[],
    timestamp: string,
    chainId: string,
    isSWC?: boolean,
  ): Promise<string> {
    const message = this.prepareTypedData(payload, timestamp)
    const types = getAuthEIP721Types(payload)
    const delegateSigner = await this.getDelegateSigner(this)
    const signer = delegateSigner ?? provider.signer
    const usingDelegate = !!delegateSigner
    const domain = { ...eip721Domain, chainId }

    // For SWC without delegate, hash the typed data and sign the hash
    if (isSWC && !usingDelegate) {
      const messageHash = TypedDataEncoder.hash(domain, types, message)
      log('EIP-712 hash (SWC without delegate):', messageHash)
      const hashBytes = getBytes(messageHash)
      const signature = await signer.signMessage(hashBytes)
      log('Message signed with EIP-712 for SWC. Signature:', signature)
      return signature
    }

    // For EOA, sign typed data normally
    log(
      'Signing typed data',
      JSON.stringify({ message, types, domain }, null, 2),
    )
    // Log the EIP-712 hash right before signing (signTypedData hashes internally)
    const messageHash = TypedDataEncoder.hash(domain, types, message)
    log('EIP-712 hash (EOA):', messageHash)
    const signature = await this.signTypedData(signer, domain, types, message)
    log('Message signed with EIP-712. Signature:', signature)
    return signature
  }

  /**
   * Signs a message using the provided signer.
   * This method can be overridden to customize the signing process.
   * @param signer - The signer to use
   * @param message - The message to sign
   * @returns A promise that resolves to the signature string
   */
  protected async signMessage(signer: any, message: string): Promise<string> {
    return signer.signMessage(message)
  }

  /**
   * Signs typed data using the provided signer.
   * This method can be overridden to customize the signing process.
   * @param signer - The signer to use
   * @param domain - The EIP-712 domain
   * @param types - The EIP-712 types
   * @param message - The message to sign
   * @returns A promise that resolves to the signature string
   */
  protected async signTypedData(
    signer: any,
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    message: Record<string, any>,
  ): Promise<string> {
    return signer.signTypedData(domain, types, message)
  }

  public setContract(contract: Contract, contractMethodsToSign: string[]) {
    log('Setting contract and methods to sign: ', contractMethodsToSign)
    this.contracts.push({
      contract,
      contractMethodsToSign,
    })
  }

  /**
   * Calculates the fromBlock value for eth_getUserOperationReceipt requests.
   * Gets the current block number and subtracts the configured userOperationReceiptLookupRange.
   *
   * IMPORTANT: The bundler strictly validates this value and will reject the request if:
   * - The header is missing
   * - The value is < 0
   * - The value is > current block number
   * - The value is too far back (< currentBlock - userOperationReceiptLookupRange)
   *
   * This method ensures the returned value is always within the valid range:
   * max(0, currentBlock - userOperationReceiptLookupRange) <= fromBlock <= currentBlock
   *
   * @param provider - The provider to use for fetching the current block number
   * @returns A promise that resolves to the fromBlock value as a bigint
   * @throws Error if unable to fetch the current block number
   */
  protected async getFromBlockForUserOperationReceipt(
    provider: any,
  ): Promise<bigint> {
    // Get the user operation receipt lookup range from config, or use default
    const lookupRange = BigInt(
      this.config.userOperationReceiptLookupRange ??
        DEFAULT_USER_OPERATION_RECEIPT_LOOKUP_RANGE,
    )
    log('User operation receipt lookup range:', lookupRange.toString())

    // Get current block number
    let currentBlockNumber: bigint
    if (typeof provider.getBlockNumber === 'function') {
      // Use the provider's getBlockNumber method if available (ethers-style)
      currentBlockNumber = BigInt(await provider.getBlockNumber())
    } else if (typeof provider.request === 'function') {
      // Fall back to direct RPC request
      const blockNumberHex = await provider.request({
        method: 'eth_blockNumber',
        params: [],
      })
      currentBlockNumber = BigInt(blockNumberHex)
    } else {
      throw new Error(
        'Provider does not support getBlockNumber or request method',
      )
    }

    log('Current block number:', currentBlockNumber.toString())

    // Calculate fromBlock = max(0, currentBlock - lookupRange)
    // This ensures we're always within the valid range that the bundler expects
    const fromBlock =
      currentBlockNumber > lookupRange ? currentBlockNumber - lookupRange : 0n

    log('Calculated fromBlock:', fromBlock.toString())

    return fromBlock
  }

  /**
   * Builds a custom eth_getLogs payload for signing when the original request is eth_getUserOperationReceipt.
   * This method can be overridden to customize the payload construction.
   *
   * IMPORTANT: The bundler must reconstruct this exact payload to verify the signature.
   * The bundler should use the same `id` from the original eth_getUserOperationReceipt request
   * when constructing the eth_getLogs request to send to the RPC node.
   *
   * @param payload - The original eth_getUserOperationReceipt payload
   * @param fromBlock - The fromBlock value to use in the eth_getLogs filter
   * @returns A JsonRpcPayload with method 'eth_getLogs' to be used for signing
   */
  protected buildGetUserOperationReceiptSigningPayload(
    payload: JsonRpcPayload,
    fromBlock: bigint,
  ): JsonRpcPayload {
    return {
      jsonrpc: payload.jsonrpc,
      method: 'eth_getLogs',
      params: [
        {
          address: ENTRYPOINT_ADDRESS,
          fromBlock: `0x${fromBlock.toString(16)}`,
          topics: [
            PRIVATE_EVENT_SIGNATURE_HASH,
            USER_OPERATION_EVENT_HASH, // eventType
          ],
        },
      ],
      id: payload.id ?? 1,
    }
  }

  /**
   * Prepares the message to be signed for the x-signature header.
   */
  public prepareMessage(
    chainId: string,
    payload: JsonRpcPayload | JsonRpcPayload[],
    timestamp: string,
  ): string {
    log('Preparing raw message for signing', {
      payload: JSON.stringify(payload, null, 2),
      timestamp,
    })
    const serialRequest = JSON.stringify(payload)
    const xMessage = chainId + serialRequest + timestamp
    log('Raw message to be signed:', xMessage)
    return xMessage
  }

  /**
   * Prepares the message to be signed for the x-eip712-signature header.
   */
  public prepareTypedData(
    payload: JsonRpcPayload | JsonRpcPayload[],
    timestamp: string,
  ): AuthSignatureMessage {
    log('Preparing payload for signTypedData')

    const preparedPayload = Array.isArray(payload)
      ? payload.map(prepareTypedDataPayload)
      : prepareTypedDataPayload(payload)

    const message = {
      request: preparedPayload,
      timestamp,
    }

    log('Prepared payload for signTypedData', JSON.stringify(message, null, 2))
    return message
  }
}
