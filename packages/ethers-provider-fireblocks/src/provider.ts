import { FireblocksWeb3Provider } from '@fireblocks/fireblocks-web3-provider'
import {
  BaseConfig,
  DEBUG_NAMESPACE,
  HEADER_DELEGATE,
  HEADER_DELEGATE_SIGNATURE,
  HEADER_EIP712_DELEGATE_SIGNATURE,
  isSignableContractCall,
  SIGN_RPC_METHODS,
  SignatureType,
} from '@appliedblockchain/silentdatarollup-core'
import debug from 'debug'
import {
  BrowserProvider,
  BrowserProviderOptions,
  Eip1193Provider,
  hexlify,
  keccak256,
  Networkish,
  Transaction,
} from 'ethers'
import { TransactionOperation } from 'fireblocks-sdk'
import { SilentDataRollupFireblocksBase } from './Base'

const log = debug(DEBUG_NAMESPACE)

export class SilentDataRollupFireblocksProvider extends BrowserProvider {
  private lastNonce: { [address: string]: number } = {}
  private ethereum: FireblocksWeb3Provider
  private network: Networkish | undefined
  private _options: BrowserProviderOptions | undefined
  private config: BaseConfig
  private baseProvider: SilentDataRollupFireblocksBase

  constructor({
    ethereum,
    network,
    options,
    config = {},
  }: {
    ethereum: Eip1193Provider
    network?: Networkish
    options?: BrowserProviderOptions
    config?: BaseConfig
  }) {
    super(ethereum, network, options)
    log('Initializing SilentDataRollupFireblocksProvider')
    this.setupInterceptor(ethereum, network, options)
    this.ethereum = ethereum as FireblocksWeb3Provider
    this.network = network
    this._options = options
    this.config = {
      ...config,
      authSignatureType: config?.authSignatureType ?? SignatureType.Raw,
    }
    this.baseProvider = new SilentDataRollupFireblocksBase(config)
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
    const currentNonce = await this.getTransactionCount(address)
    this.lastNonce[address] = this.lastNonce[address] || currentNonce
    const nonce = Math.max(this.lastNonce[address], currentNonce)
    this.lastNonce[address] = nonce + 1
    return nonce
  }

  /**
   * Custom method to handle transaction creation, signing, and broadcasting.
   *
   * This method is necessary because:
   * 1. When using Fireblocks to sign a transaction with CONTRACT_CALL,
   *    Fireblocks also broadcasts the transaction to the specified chain
   *    on the Fireblocks provider configuration.
   * 2. We need to manually handle the transaction creation process instead of
   *    delegating everything to Fireblocks, as we need to broadcast it to our
   *    own nodes.
   * 3. When populating a transaction (e.g., getting the nonce), we need to make
   *    requests with auth headers to our RPC.
   *
   * This custom implementation allows us to control the entire process,
   * from transaction creation to signing and broadcasting. It ensures that
   * the necessary authenticated requests are made when populating the transaction,
   * and that the final transaction is broadcast to our specific nodes.
   *
   * @param payload - The transaction payload to be sent
   * @returns The transaction hash
   */
  public async sendTransaction(payload: any) {
    log('Starting signAndBroadcastTransaction')
    if (payload.method !== 'eth_sendTransaction') {
      log('Not an eth_sendTransaction method, skipping')
      throw new Error('Not an eth_sendTransaction method.')
    }

    const nonce = await this.getNextNonce(payload.params[0].from)
    const chainId = (await this.getNetwork()).chainId
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.getFeeData()
    const gasLimit = await this.estimateGas(payload.params[0])

    const txParams = {
      type: 2,
      chainId,
      nonce,
      to: payload.params[0].to,
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit,
      data: payload.params[0].data,
      value: payload.params[0].value,
    }
    log('Transaction params:', txParams)

    const tx = Transaction.from(txParams)

    const txHash = keccak256(tx.unsignedSerialized)
    const txHashHex = hexlify(txHash).slice(2)
    log('Transaction hash to sign:', txHashHex)

    log('Creating signature')
    const signature = await this.baseProvider.createPersonalSignature(
      this,
      txHashHex,
      TransactionOperation.RAW,
    )
    log('Signature created:', signature)

    tx.signature = signature
    log('Signature added to transaction')

    log('Broadcasting transaction')
    const signedTx = tx.serialized
    try {
      await this.broadcastTransaction(signedTx)
      log('Transaction broadcasted')
    } catch (error) {
      log('Transaction broadcast failed')
      throw error
    }

    log('Transaction hash:', tx.hash)
    return tx.hash
  }

  private setupInterceptor(
    ethereum: Eip1193Provider,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    network?: Networkish,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: BrowserProviderOptions,
  ): void {
    const originalSend = (ethereum as any).send
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this

    ;(ethereum as any).send = async (
      payload: any,
      callback: (error: any, response: any) => void,
    ) => {
      ;(async () => {
        if (payload.method === 'eth_sendTransaction') {
          return that.sendTransaction(payload)
        }

        const requiresAuthHeaders =
          SIGN_RPC_METHODS.includes(payload.method) ||
          isSignableContractCall(
            payload,
            this.baseProvider.contractMethodsToSign,
            this.baseProvider.contract,
          )

        const delegateHeaders = []
        if (requiresAuthHeaders) {
          log(`Intercepted request: ${JSON.stringify(payload, null, 2)}`)
          if (this.config.delegate) {
            const {
              [HEADER_DELEGATE]: xDelegate,
              [HEADER_DELEGATE_SIGNATURE]: xDelegateSignature,
              [HEADER_EIP712_DELEGATE_SIGNATURE]: xEip712DelegateSignature,
            } = await this.baseProvider.getDelegateHeaders(this)

            delegateHeaders.push({ name: HEADER_DELEGATE, value: xDelegate })
            if (xDelegateSignature) {
              delegateHeaders.push({
                name: HEADER_DELEGATE_SIGNATURE,
                value: xDelegateSignature,
              })
            }
            if (xEip712DelegateSignature) {
              delegateHeaders.push({
                name: HEADER_EIP712_DELEGATE_SIGNATURE,
                value: xEip712DelegateSignature,
              })
            }
          }

          const clonedEthereum = new FireblocksWeb3Provider(
            (ethereum as any).config,
          )
          const authHeaders = await this.baseProvider.getAuthHeaders(
            this,
            payload,
          )
          const allHeaders = [...delegateHeaders]

          for (const [key, value] of Object.entries(authHeaders)) {
            allHeaders.push({ name: key, value: value })
          }

          ;(clonedEthereum as any).headers = allHeaders
          log('Sending request with auth headers')
          return originalSend.call(clonedEthereum, payload, callback)
        }

        const result = await originalSend.call(ethereum, payload, callback)
        return result
      })()
    }
  }

  clone(): SilentDataRollupFireblocksProvider {
    log('Cloning SilentDataRollupFireblocksProvider')
    const newFireblocksProvider = new FireblocksWeb3Provider(
      (this as any).ethereum.config,
    )

    const clonedProvider = new SilentDataRollupFireblocksProvider({
      ethereum: newFireblocksProvider,
      network: this.network,
      options: this._options,
      config: this.config,
    })

    log('SilentDataRollupFireblocksProvider cloned successfully')
    return clonedProvider
  }
}
