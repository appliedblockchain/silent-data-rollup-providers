import { Contract, Interface } from 'ethers'
import { SilentDataRollupContractConfig } from './types'

export class SilentDataRollupContract extends Contract {
  constructor(config: SilentDataRollupContractConfig) {
    const { address, abi, runner, contractMethodsToSign } = config

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

    super(address, abi, runner)

    const baseProvider =
      (runner as any).baseProvider || (runner as any).provider?.baseProvider
    if (typeof baseProvider?.setContract === 'function') {
      baseProvider.setContract(this, contractMethodsToSign)
    }
  }
}
