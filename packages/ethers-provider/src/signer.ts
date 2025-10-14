import {
  AbstractSigner,
  assert,
  Provider,
  Signer,
  TransactionRequest,
  TransactionResponse,
  TypedDataDomain,
  TypedDataField,
} from 'ethers'

export class SilentDataRollupSigner extends AbstractSigner {
  private signer: Signer

  constructor(provider: Provider, signer: Signer) {
    if (!provider) {
      throw new Error('Provider is required')
    }
    if (!signer) {
      throw new Error('Signer is required')
    }
    super(provider)
    this.signer = signer
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  connect(provider: null | Provider): Signer {
    assert(
      false,
      'cannot reconnect SilentDataRollupSigner',
      'UNSUPPORTED_OPERATION',
      {
        operation: 'signer.connect',
      },
    )
  }

  async getAddress(): Promise<string> {
    return this.signer.getAddress()
  }

  async signTransaction(tx: TransactionRequest): Promise<string> {
    return this.signer.signTransaction(tx)
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    return this.signer.signMessage(message)
  }

  signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    value: Record<string, any>,
  ): Promise<string> {
    return this.signer.signTypedData(domain, types, value)
  }

  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    let gasLimit = tx.gasLimit
    if (!gasLimit) {
      gasLimit = await this.estimateGas(tx)
    }
    return this.signer.sendTransaction({ ...tx, gasLimit })
  }
}
