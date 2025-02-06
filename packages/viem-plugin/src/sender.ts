/**
 * Manages the sending of RPC requests to the Silent Data Rollup Provider with session handling.
 * This class implements request queueing for signable transactions and contract calls
 * when a signing session is in progress.
 */
import { DELEGATE_EXPIRATION_THRESHOLD_BUFFER, SIGN_RPC_METHODS } from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupProvider } from './provider'

export class Sender {
  /** Flag indicating if a signing session is currently active */
  public isSigningSession = false
  
  /** Queue of pending requests waiting for the current signing session to complete */
  public queue: { method: string, params: any, resolve: (value: any) => void, reject: (reason?: any) => void }[] = []

  constructor(
    /** The Silent Data Rollup Provider instance used for sending requests */
    private provider: SilentDataRollupProvider
  ) {}

  /**
   * Sends an RPC request to the provider, handling signing sessions and request queueing.
   * @param method - The RPC method name to be called
   * @param params - The parameters for the RPC method
   * @returns Promise resolving to the RPC call result
   * 
   * If the request is not signable or the session is valid, it's sent immediately.
   * Otherwise, if a signing session is in progress, the request is queued.
   * For new signing sessions, the request is processed and the queue is handled afterward.
   */
  async send(method: string, params: any) {
    // Session is valid or request is not signable, send immediately
    if (
      !this._isSignableTransaction(method)
      && !this._isSignableContractCall(method, params)
      || this._isSessionValid()
    ) {
      return this.provider.send(method, params)
    }

    //Queue request other requests
    if (this.isSigningSession) {
      return new Promise((resolve, reject) => {
        this.queue.push({ method, params, resolve, reject })
      })
    }

    this.isSigningSession = true

    try {
      const result = await this.provider.send(method, params)
      return result
    } catch (error) {
      throw error
    } finally {
      this.isSigningSession = false
      await this._processQueue()
    }
  }

  /**
   * Processes all queued requests in order after a signing session completes.
   * Each queued request is sent and its promise is resolved or rejected accordingly.
   * @private
   */
  private async _processQueue() {
    for (const request of this.queue) {
      try {
        const result = await this.provider.send(request.method, request.params)
        request.resolve(result)
      } catch (error) {
        request.reject(error)
      }
    }

    this.queue = []
  }

  /**
   * Checks if the current session is valid by verifying cached delegate headers
   * and their expiration time against the current timestamp.
   * @private
   * @returns boolean indicating if the session is valid
   */
  private _isSessionValid() {
    const baseProvider = this.provider.baseProvider

    const now = Math.floor(Date.now() / 1000)
  
    return (
      // @ts-ignore
      !!baseProvider.cachedDelegateHeaders &&
      // @ts-ignore
      baseProvider.cachedHeadersExpiry - DELEGATE_EXPIRATION_THRESHOLD_BUFFER > now
    )
  }

  /**
   * Determines if a contract call requires signing based on the method and parameters.
   * @private
   * @param method - The RPC method name
   * @param params - The parameters for the RPC method
   * @returns boolean indicating if the contract call requires signing
   */
  private _isSignableContractCall(method: string, params: any) {
    return this.provider.isSignableContractCall({
      method,
      params
    })
  }

  /**
   * Checks if an RPC method requires signing by comparing against known signing methods.
   * @private
   * @param method - The RPC method name to check
   * @returns boolean indicating if the method requires signing
   */
  private _isSignableTransaction(method: string) {
    return SIGN_RPC_METHODS.includes(method)
  }
}