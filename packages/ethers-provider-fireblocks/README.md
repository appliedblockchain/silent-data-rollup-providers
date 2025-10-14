# Silent Data Providers - Ethers Provider Fireblocks Package

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

Custom providers for Silent Data, compatible with ethers.js for Fireblocks integration.

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

const contractConfig = {
  contractAddress: 'YOUR_CONTRACT_ADDRESS'
  abi: [ /* Your contract ABI */ ],
  runner: signer,
  methodsToSign: ['method1', 'method2'] // Contract read calls that require signing
}

const contract = new SilentDataRollupContract(contractConfig)

// Now you can call "private" contract methods. These calls will be signed,
// and msg.sender will be available in the contract, representing the signer's address.
const privateMethodResult = await contract.method1('param1', 'param2')
console.log('Private method result:', privateMethodResult)

// You can also call methods that don't require signing.
// These calls won't include a signature, and msg.sender won't be available in the contract.
const publicMethodResult = await contract.method3('param1', 'param2')
console.log('Public method result:', publicMethodResult)
```

**Note:** The SilentDataRollupFireblocksProvider adds an additional namespace on top of the Fireblocks provider for debugging purposes. This namespace is the same as the Fireblocks namespace with an additional `:silentdata-interceptor` suffix. For example, if the Fireblocks namespace is `fireblocks:web3-provider`, the SilentData provider's namespace would be `fireblocks:web3-provider:silentdata-interceptor`.

To enable debugging for the SilentData interceptor, you can set the following environment variable:

```bash
DEBUG=fireblocks:web3-provider:silentdata-interceptor
```

This will output debug information specific to the SilentData interceptor, helping you troubleshoot issues related to the Silent Data integration with Fireblocks.

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure you're using the correct RPC URL for your desired network.
2. Verify that the Fireblocks configuration is correctly set up and ensure your user and API keys are valid.
3. Ensure that your token is active on the SilentData AppChains dashboard.

## License

This project is licensed under the [MIT License](LICENSE).

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Fireblocks Developer Documentation](https://developers.fireblocks.com/api)
- [Fireblocks Web3 Provider](https://developers.fireblocks.com/reference/evm-web3-provider)
