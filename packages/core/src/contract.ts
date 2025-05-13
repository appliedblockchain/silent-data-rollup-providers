import {
  Contract,
  ContractRunner,
  Interface,
  Provider,
  Signer,
  TransactionRequest,
  TransactionResponse,
  assertArgument,
} from 'ethers'
import { SilentDataRollupContractConfig } from './types'

/**
 * Custom contract runner that handles transaction submission
 * with proper nonce management. This ensures transactions are sent with
 * the latest nonce value to prevent transaction ordering issues.
 */
class CustomContractRunner implements ContractRunner {
  provider: Provider
  private signer: Signer

  constructor(provider: Provider, signer: Signer) {
    this.provider = provider
    this.signer = signer
  }

  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    const signerAddress = await this.signer.getAddress()
    const latestNonce = await this.provider.getTransactionCount(
      signerAddress,
      'latest',
    )
    tx.nonce = latestNonce
    return this.signer.sendTransaction(tx)
  }
}

function getContractRunner(
  runner: SilentDataRollupContractConfig['runner'],
  provider: SilentDataRollupContractConfig['provider'],
): SilentDataRollupContractConfig['runner'] | CustomContractRunner {
  const runnerIsSigner = typeof runner.sendTransaction === 'function'

  // If the runner is not a Signer return the runner as is
  if (!runnerIsSigner) {
    return runner
  }

  // Get the runner provider constructor name
  const runnerProviderConstructor = runner.provider?.constructor.name ?? ''

  /**
   * If the runner provider is not part of the Silent Data Rollup providers
   * we check if the provider is provided and create a new CustomContractRunner
   * with the provider and signer
   */
  if (!runnerProviderConstructor.includes('SilentDataRollupProvider')) {
    assertArgument(provider, 'provider is mandatory', 'provider', provider)

    return new CustomContractRunner(provider, runner as Signer)
  }

  /**
   * If the runner provider is part of the Silent Data Rollup providers
   * we create a new CustomContractRunner with the runner provider and signer
   */
  return new CustomContractRunner(runner.provider as Provider, runner as Signer)
}

export class SilentDataRollupContract extends Contract {
  constructor(config: SilentDataRollupContractConfig) {
    const { address, abi, runner, contractMethodsToSign, provider } = config

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

    const contractRunner = getContractRunner(runner, provider)

    super(address, abi, contractRunner)

    const baseProvider =
      (runner as any).baseProvider || (runner as any).provider?.baseProvider
    if (typeof baseProvider?.setContract === 'function') {
      baseProvider.setContract(this, contractMethodsToSign)
    }
  }
}
