# Silent Data [Rollup] Providers - Ethers Provider Fireblocks Package

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Integration](#integration)
  - [Fireblocks Integration](#fireblocks-integration)
    - [Installing Fireblocks Integration Dependencies](#installing-fireblocks-integration-dependencies)
    - [Fireblocks Integration Example](#fireblocks-integration-example)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Additional Resources](#additional-resources)

## Introduction

Custom providers for Silent Data [Rollup], compatible with ethers.js for Fireblocks integration.

## Prerequisites

- Node.js (version 18 or higher)
- npm
- Basic knowledge of Ethereum and smart contracts
- Ethers.js v6

## Integration

### Fireblocks Integration

#### Installing Fireblocks Integration Dependencies

```bash
npm install @appliedblockchain/silentdatarollup-core @appliedblockchain/silentdatarollup-ethers-provider-fireblocks ethers@6 @fireblocks/fireblocks-web3-provider
```

#### Fireblocks Integration Example

```typescript
import {
  ApiBaseUrl,
  ChainId,
  FireblocksWeb3Provider,
} from '@fireblocks/fireblocks-web3-provider'
import {
  BaseConfig,
  SilentDataRollupContract,
} from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupFireblocksProvider } from '@appliedblockchain/silentdatarollup-ethers-provider-fireblocks'

const RPC_URL = 'SILENT_DATA_ROLLUP_RPC_URL'

const eip1193Provider = new FireblocksWeb3Provider({
  privateKey: 'FIREBLOCKS_PATH_TO_PRIVATE_KEY',
  apiKey: 'FIREBLOCKS_API_KEY',
  vaultAccountIds: 'FIREBLOCKS_VAULT_ACCOUNT_ID',
  assetId: ASSETS[ChainId.SEPOLIA].assetId,
  chainId: ChainId.SEPOLIA,
  apiBaseUrl: ApiBaseUrl.Sandbox, // If using a sandbox workspace
  rpcUrl: 'SILENT_DATA_ROLLUP_RPC_URL',
})

const silentdataOptions: BaseConfig = {
  authSignatureType: SignatureType.EIP712, // Optional, defaults to RAW
  delegate: true, // Optional, defaults to false
}

const provider = new SilentDataRollupFireblocksProvider({
  ethereum: eip1193Provider,
  silentdataOptions,
})
const balance = await provider.getBalance('YOUR_ADDRESS')
console.log(balance)

const signer = await provider.getSigner()
const contractAddress = 'YOUR_CONTRACT_ADDRESS'
const abi = [
  /* Your contract ABI */
]
const methodsToSign = ['balance'] // Contract read calls that require signing

const contract = new SilentDataRollupContract(
  contractAddress,
  abi,
  signer,
  methodsToSign,
)

const tokenBalance = await contract.balance('YOUR_ADDRESS')
console.log(tokenBalance)
```

**Note:** The SilentDataRollupFireblocksProvider adds an additional namespace on top of the Fireblocks provider for debugging purposes. This namespace is the same as the Fireblocks namespace with an additional `:silentdata-interceptor` suffix. For example, if the Fireblocks namespace is `fireblocks:web3-provider`, the SilentData provider's namespace would be `fireblocks:web3-provider:silentdata-interceptor`.

To enable debugging for the SilentData interceptor, you can set the following environment variable:

```bash
DEBUG=fireblocks:web3-provider:silentdata-interceptor
```

This will output debug information specific to the SilentData interceptor, helping you troubleshoot issues related to the Silent Data [Rollup] integration with Fireblocks.

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure you're using the correct RPC URL for your desired network.
2. Verify that the Fireblocks configuration is correctly set up and ensure your user and API keys are valid.
3. Ensure that your token is active on the SilentData AppChains dashboard.

## License

This project is licensed under the [MIT License](LICENSE).

## Additional Resources

- [Silent Data [Rollup] Documentation](https://docs.silentdata.com)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Fireblocks Developer Documentation](https://developers.fireblocks.com/api)
- [Fireblocks Web3 Provider](https://developers.fireblocks.com/reference/evm-web3-provider)
