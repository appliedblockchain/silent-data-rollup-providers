import {
  Contract,
  ContractRunner,
  Interface,
  InterfaceAbi,
  Provider,
  Signer,
  TransactionRequest,
  TransactionResponse,
} from 'ethers'

/**
 * Custom contract runner that handles transaction submission
 * with proper nonce management. This ensures transactions are sent with
 * the latest nonce value to prevent transaction ordering issues.
 */
class CustomContractRunner implements ContractRunner {
  provider: Provider | null
  private signer: Signer

  constructor(signer: Signer) {
    this.provider = signer.provider
    this.signer = signer
  }

  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    tx.nonce = await this.signer.getNonce()
    return this.signer.sendTransaction(tx)
  }
}

export class SilentDataRollupContract extends Contract {
  constructor(
    address: string,
    abi: InterfaceAbi,
    runner: ContractRunner,
    contractMethodsToSign: string[],
  ) {
    /**
     * Validates that all methods specified for signing exist in the contract ABI.
     * This check ensures that only legitimate contract functions are marked for signing,
     * preventing potential errors or security issues from mistyped or non-existent methods.
     */
    const contractInterface = new Interface(abi)
    contractMethodsToSign.forEach((method) => {
      if (!contractInterface.hasFunction(method)) {
        throw new Error(
          `Method to sign '${method}' not found in the contract ABI`,
        )
      }
    })

    const baseProvider =
      (runner as any).baseProvider || (runner as any).provider?.baseProvider

    /**
     * If the runner is a Signer, create a CustomContractRunner to handle
     * transaction submission with proper nonce management.
     */
    const runnerIsSigner = typeof (runner as any).sendTransaction === 'function'
    if (runnerIsSigner) {
      runner = new CustomContractRunner(runner as Signer)
    }

    super(address, abi, runner)

    if (typeof baseProvider?.setContract === 'function') {
      baseProvider.setContract(this, contractMethodsToSign)
    }
  }
}
