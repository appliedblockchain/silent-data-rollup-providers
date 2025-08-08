import {
  eip721Domain,
  getAuthEIP721Types,
  HEADER_EIP712_SIGNATURE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  SignatureType,
  SilentDataRollupBase,
} from '@appliedblockchain/silentdatarollup-core'
import { TransactionReceipt } from '@ethersproject/abstract-provider'
import { FireblocksWeb3Provider } from '@fireblocks/fireblocks-web3-provider'
import debug from 'debug'
import { hashMessage, hexlify, keccak256, Transaction } from 'ethers'
import {
  PeerType,
  TransactionArguments,
  TransactionOperation,
} from 'fireblocks-sdk'
import { ProviderWrapper } from 'hardhat/plugins'
import { EIP1193Provider, RequestArguments } from 'hardhat/types'
import {
  DEBUG_NAMESPACE,
  DEFAULT_MAX_RETRIES,
  DEFAULT_POLLING_INTERVAL,
  SIGN_RPC_METHODS,
} from './constants'
import { SilentdataNetworkConfig } from './types'

const log = debug(DEBUG_NAMESPACE)

export class SilentDataFireblocksSigner extends ProviderWrapper {
  private _fireblocksWeb3Provider: FireblocksWeb3Provider
  private config: SilentdataNetworkConfig
  private lastNonce: { [address: string]: number } = {}
  private maxRetries: number
  private pollingInterval: number
  private baseProvider: SilentDataRollupBase

  constructor(provider: EIP1193Provider, config: SilentdataNetworkConfig) {
    super(provider)
    log('SilentDataFireblocksSigner initialized')
    const fireblocksWeb3Provider = (provider as any)._provider._wrappedProvider
      ._wrappedProvider._fireblocksWeb3Provider
    this.setupInterceptor(fireblocksWeb3Provider)
    this._fireblocksWeb3Provider = fireblocksWeb3Provider
    this.config = {
      ...config,
      authSignatureType: config?.authSignatureType ?? SignatureType.Raw,
    }
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
    this.pollingInterval = config.pollingInterval ?? DEFAULT_POLLING_INTERVAL
    this.baseProvider = new SilentDataRollupBase(config)
  }

  public async request(args: RequestArguments): Promise<unknown> {
    log('.request()', JSON.stringify(args, null, 2))
    const payload = {
      jsonrpc: '2.0',
      ...args,
      id: Math.floor(Math.random() * 10000000000),
    }

    if (args.method === 'eth_sendTransaction') {
      return this.sendTransaction(payload)
    }

    const result = await new Promise((resolve, reject) => {
      ;(this._fireblocksWeb3Provider as any).send(
        payload,
        (error: any, response: any) => {
          if (error) {
            reject(error)
          } else {
            resolve(response.result)
          }
        },
      )
    })

    return result
  }

  public send(method: string, params: any[]): Promise<any> {
    log('Provider .send() method called:', method)
    return this.request({ method, params })
  }

  public sendAsync(
    payload: { method: string; params: any[] },
    callback: (error: any, result?: any) => void,
  ): void {
    log('Provider .sendAsync() method called:', payload.method)
    this.request(payload).then(callback).catch(callback)
  }

  private setupInterceptor(provider: EIP1193Provider): void {
    log('Setting up silent data interceptor for Fireblocks')
    const originalSend = (provider as any).send

    ;(provider as any).send = async (
      payload: any,
      callback: (error: any, response: any) => void,
    ) => {
      ;(async () => {
        const requiresAuthHeaders = SIGN_RPC_METHODS.includes(payload.method)

        if (payload.method === 'eth_sendTransaction') {
          try {
            const result = await this.sendTransaction(payload)
            callback(null, result)
          } catch (error) {
            callback(error, null)
          }
          return
        }

        log('Intercepted send method:', JSON.stringify(payload, null, 2))

        if (requiresAuthHeaders) {
          log('Request requires auth headers')
          const clonedEthereum = new FireblocksWeb3Provider(
            (provider as any).config,
          )

          const authHeaders = await this.getAuthHeaders(payload)
          const allHeaders = []
          for (const [key, value] of Object.entries(authHeaders)) {
            allHeaders.push({ name: key, value: value })
          }

          ;(clonedEthereum as any).headers = allHeaders
          log('Auth headers set for cloned FireblocksWeb3Provider provider')

          return originalSend.call(clonedEthereum, payload, callback)
        }

        const result = await originalSend.call(provider, payload, callback)
        return result
      })()
    }
  }

  private async signMessage(
    content: any,
    operation: TransactionOperation,
    type?: SignatureType,
  ): Promise<string> {
    const vaultAccountId = (
      this._fireblocksWeb3Provider! as any
    ).vaultAccountIds[0]?.toString()

    const transactionArguments: TransactionArguments = {
      operation: operation,
      assetId: (this._fireblocksWeb3Provider! as any).assetId,
      source: {
        type: PeerType.VAULT_ACCOUNT,
        id: vaultAccountId,
      },
      extraParameters: {
        rawMessageData: {
          messages: [
            {
              content,
              ...(type ? { type } : {}),
            },
          ],
        },
      },
    }

    log('Creating transaction', JSON.stringify(transactionArguments, null, 2))
    const txInfo = await (
      this._fireblocksWeb3Provider! as any
    ).createTransaction(transactionArguments)
    const sig = txInfo!.signedMessages![0].signature
    const v = 27 + sig.v!
    return '0x' + sig.r + sig.s + v.toString(16)
  }

  private async getAuthHeaders(payload: any): Promise<{
    [HEADER_TIMESTAMP]: string
    [HEADER_SIGNATURE]?: string
    [HEADER_EIP712_SIGNATURE]?: string
  }> {
    log('Getting auth headers for method:', JSON.stringify(payload, null, 2))
    const requestId = (this._wrappedProvider as any)._provider._wrappedProvider
      ._wrappedProvider._wrappedProvider._nextRequestId
    const rpcRequest = {
      jsonrpc: '2.0',
      ...payload,
      id: requestId,
    }
    const xTimestamp = new Date().toISOString()
    const headers: {
      [HEADER_TIMESTAMP]: string
      [HEADER_SIGNATURE]?: string
      [HEADER_EIP712_SIGNATURE]?: string
    } = {
      [HEADER_TIMESTAMP]: xTimestamp,
    }

    const chainId = await this.getChainId()
    const signatureType = this.config?.authSignatureType ?? SignatureType.Raw

    let content
    switch (signatureType) {
      case SignatureType.Raw:
        // eslint-disable-next-line no-case-declarations
        const preparedMessage = this.baseProvider.prepareSignatureMessage(
          chainId.toString(),
          rpcRequest,
          xTimestamp,
        )
        content = hashMessage(preparedMessage).slice(2)
        break
      case SignatureType.EIP712:
        // eslint-disable-next-line no-case-declarations
        const types = getAuthEIP721Types(payload)
        // eslint-disable-next-line no-case-declarations
        const message = this.baseProvider.prepareSignatureTypedData(
          payload,
          xTimestamp,
        )
        content = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
            ],
            ...types,
          },
          primaryType: 'Call',
          domain: { ...eip721Domain, chainId },
          message: message,
        }

        break
      default:
        throw new Error(`Unsupported signature type: ${signatureType}`)
    }

    const signature = await this.signMessage(
      content,
      signatureType === SignatureType.Raw
        ? TransactionOperation.RAW
        : TransactionOperation.TYPED_MESSAGE,
      signatureType,
    )

    headers[
      signatureType === SignatureType.Raw
        ? HEADER_SIGNATURE
        : HEADER_EIP712_SIGNATURE
    ] = signature

    log('Auth headers generated successfully')
    return headers
  }

  /**
   * Manages and returns the next available nonce for a given address.
   *
   * This method implements a local nonce management system to handle concurrent
   * transactions and potential network delays. It's necessary because:
   * 1. Multiple transactions can be initiated before earlier ones are confirmed.
   * 2. We need to ensure each transaction uses a unique, incrementing nonce.
   *
   * The method works by:
   * - Tracking the last used nonce for each address.
   * - Comparing it with the current network nonce.
   * - Always returning a nonce higher than both the network nonce and the last used nonce.
   *
   * This approach helps prevent nonce conflicts and ensures transactions can be
   * sent in rapid succession without waiting for network confirmation.
   *
   * @param address - The Ethereum address for which to get the next nonce.
   * @returns A Promise that resolves to the next available nonce as a number.
   */
  private async getNextNonce(address: string): Promise<number> {
    try {
      log('Getting next nonce for address:', address)

      const currentNonce = (await this._wrappedProvider.request({
        method: 'eth_getTransactionCount',
        params: [address, 'latest'],
      })) as string

      const currentNonceNumber = parseInt(currentNonce, 16)
      log('Current nonce from provider:', currentNonceNumber)

      this.lastNonce[address] = Math.max(
        this.lastNonce[address] || 0,
        currentNonceNumber,
      )

      this.lastNonce[address]++
      const nextNonce = this.lastNonce[address] - 1
      log('Next nonce to be used:', nextNonce)

      return nextNonce
    } catch (error) {
      log('Error fetching nonce:', error)
      throw new Error('Failed to get next nonce')
    }
  }

  private async getTransactionParams(payload: any): Promise<any> {
    const from = payload.params[0].from
    const nonce = await this.getNextNonce(from)
    log('Using nonce:', nonce)

    const chainId = await this.getChainId()
    log('Chain ID:', chainId)

    const [maxPriorityFeePerGas, maxFeePerGas] = await this.getFeeData()
    log('Max Priority Fee Per Gas:', maxPriorityFeePerGas.toString())
    log('Max Fee Per Gas:', maxFeePerGas.toString())

    const gasLimit = await this.estimateGasLimit(payload.params[0])
    log('Estimated gas limit:', gasLimit)

    return {
      type: 2,
      chainId,
      nonce,
      to: payload.params[0].to,
      maxFeePerGas: maxFeePerGas.toString(),
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      gasLimit,
      data: payload.params[0].data,
      value: payload.params[0].value,
    }
  }

  private async getChainId(): Promise<number> {
    const networkResult = (await this._wrappedProvider.request({
      method: 'eth_chainId',
      params: [],
    })) as string
    return parseInt(networkResult, 16)
  }

  private async getFeeData(): Promise<[bigint, bigint]> {
    const [maxPriorityFeePerGasHex, baseFeePerGasHex] = await Promise.all([
      this._wrappedProvider.request({
        method: 'eth_maxPriorityFeePerGas',
        params: [],
      }) as Promise<string>,
      this._wrappedProvider
        .request({
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
        })
        .then((block: any) => block.baseFeePerGas) as Promise<string>,
    ])

    const maxPriorityFeePerGas = BigInt(maxPriorityFeePerGasHex)
    const baseFeePerGas = BigInt(baseFeePerGasHex)
    const maxFeePerGas = maxPriorityFeePerGas + baseFeePerGas * BigInt(2)

    return [maxPriorityFeePerGas, maxFeePerGas]
  }

  private async estimateGasLimit(txParams: any): Promise<number> {
    const gasLimitHex = (await this._wrappedProvider.request({
      method: 'eth_estimateGas',
      params: [txParams],
    })) as string
    return parseInt(gasLimitHex, 16)
  }

  private async waitForTransaction(
    txHash: string,
  ): Promise<TransactionReceipt> {
    for (let i = 0; i < this.maxRetries; i++) {
      const receipt = (await this._wrappedProvider.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      })) as TransactionReceipt | null

      if (receipt) {
        log('Transaction mined, receipt:', JSON.stringify(receipt, null, 2))

        if ((receipt.status as unknown as string) !== '0x1') {
          log('Transaction failed', receipt)
          throw new Error('Transaction failed')
        }

        return receipt
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollingInterval))
    }

    throw new Error('Transaction was not mined within the expected timeframe')
  }

  private async sendTransaction(payload: any): Promise<string> {
    log('Starting sendTransaction')
    if (payload.method !== 'eth_sendTransaction') {
      log('Not an eth_sendTransaction method, skipping')
      throw new Error('Not an eth_sendTransaction method.')
    }

    const txParams = await this.getTransactionParams(payload)
    log('Transaction params:', txParams)

    const tx = Transaction.from(txParams)

    const txHash = keccak256(tx.unsignedSerialized)
    const txHashHex = hexlify(txHash).slice(2)
    log('Transaction hash to sign:', txHashHex)

    log('Creating signature')
    const signature = await this.createPersonalSignature(
      txHashHex,
      TransactionOperation.RAW,
    )
    log('Signature created:', signature)

    tx.signature = signature
    log('Signature added to transaction')

    log('Broadcasting transaction')
    const signedTx = tx.serialized
    try {
      const txHash = (await this._wrappedProvider.request({
        method: 'eth_sendRawTransaction',
        params: [signedTx],
      })) as string

      log('Transaction broadcasted, hash:', txHash)

      await this.waitForTransaction(txHash)

      return txHash
    } catch (error) {
      log('Transaction broadcast failed:', error)
      throw error
    }
  }

  public async createPersonalSignature(
    content: any,
    operation: TransactionOperation,
    type?: SignatureType,
  ): Promise<string> {
    return this.signMessage(content, operation, type)
  }
}
