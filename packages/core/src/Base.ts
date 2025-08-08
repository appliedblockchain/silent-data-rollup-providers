import debug from 'debug'
import {
  Contract,
  JsonRpcPayload,
  Signer,
  TypedDataDomain,
  TypedDataField,
} from 'ethers'
import {
  DEBUG_NAMESPACE,
  DEFAULT_DELEGATE_EXPIRES,
  DELEGATE_EXPIRATION_THRESHOLD_BUFFER,
  delegateEIP721Types,
  eip721Domain,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
} from './constants'
import {
  AuthHeaders,
  AuthSignatureMessage,
  BaseConfig,
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
  public contract: Contract | null = null
  public contractMethodsToSign: string[] = []
  private _cachedNetwork: any = null

  constructor(config: BaseConfig) {
    this.config = {
      ...config,
      authSignatureType: config.authSignatureType ?? SignatureType.Raw,
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
   * @param provider - The provider used for signing
   * @param message - The delegate signer message to be signed
   * @returns A promise that resolves to the signature string
   */
  protected async signRawDelegateHeader(
    provider: any,
    message: string,
  ): Promise<string> {
    log('signRawDelegateHeader: Signing raw delegate header', message)

    const signature = await provider.signer.signMessage(message)

    log('signRawDelegateHeader: Raw signature generated:', signature)
    return signature
  }

  /**
   * Signs a typed delegate header message.
   * This method can be overridden by extending classes to customize the signing process.
   * @param provider - The provider used for signing
   * @param message - The delegate signer message to be signed
   * @returns A promise that resolves to the signature string
   */
  protected async signTypedDelegateHeader(
    provider: any,
    chainId: string,
    message: DelegateSignerMessage,
  ): Promise<string> {
    log('signTypedDelegateHeader: Signing typed delegate header')
    log(
      'signTypedDelegateHeader: Typed message:',
      JSON.stringify(message, null, 2),
    )

    const signature = await provider.signer.signTypedData(
      { ...eip721Domain, chainId },
      delegateEIP721Types,
      message,
    )

    log('signTypedDelegateHeader: Signature generated:', signature)
    return signature
  }

  public async getDelegateHeaders(provider: any): Promise<DelegateHeaders> {
    log('Getting delegate headers')
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

      switch (signatureType) {
        case SignatureType.Raw: {
          log('Generating delegate raw signature')
          const delegateMessageToSign =
            chainId + JSON.stringify(delegateSignerMessage)
          headers[HEADER_DELEGATE_SIGNATURE] = await this.signRawDelegateHeader(
            provider,
            delegateMessageToSign,
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

    const signatureType = this.config.authSignatureType

    switch (signatureType) {
      case SignatureType.Raw:
        log('Generating auth header raw signature')
        headers[HEADER_SIGNATURE] = await this.signAuthHeaderRawMessage(
          provider,
          payload,
          xTimestamp,
          chainId,
        )
        break
      case SignatureType.EIP712:
        log('Generating auth headerEIP712 signature')
        headers[HEADER_EIP712_SIGNATURE] = await this.signAuthHeaderTypedData(
          provider,
          payload,
          xTimestamp,
          chainId,
        )
        break
      default:
        throw new Error(`Unsupported signature type: ${signatureType}`)
    }

    log('Auth headers:', JSON.stringify(headers, null, 2))
    return headers
  }

  public async signAuthHeaderRawMessage(
    provider: any,
    payload: JsonRpcPayload | JsonRpcPayload[],
    timestamp: string,
    chainId: string,
  ): Promise<string> {
    const xMessage = this.prepareSignatureMessage(chainId, payload, timestamp)
    const delegateSigner = await this.getDelegateSigner(this)
    const signer = delegateSigner ?? provider.signer
    const signature = await this.signMessage(signer, xMessage)
    log('Message signed. Signature:', signature)
    return signature
  }

  public async signAuthHeaderTypedData(
    provider: any,
    payload: JsonRpcPayload | JsonRpcPayload[],
    timestamp: string,
    chainId: string,
  ): Promise<string> {
    const message = this.prepareSignatureTypedData(payload, timestamp)
    const types = getAuthEIP721Types(payload)
    const delegateSigner = await this.getDelegateSigner(this)
    const signer = delegateSigner ?? provider.signer
    const domain = { ...eip721Domain, chainId }
    log(
      'Signing typed data',
      JSON.stringify({ message, types, domain }, null, 2),
    )
    const signature = await this.signTypedData(signer, domain, types, message)

    log('Message signed. Signature:', signature)
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
    this.contract = contract
    this.contractMethodsToSign = contractMethodsToSign
  }

  /**
   * Prepares the message to be signed for the x-signature header.
   */
  public prepareSignatureMessage(
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
  public prepareSignatureTypedData(
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
