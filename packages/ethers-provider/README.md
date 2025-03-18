# Silent Data [Rollup] Providers - Ethers Provider Package

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Integration](#integration)
  - [Basic Usage](#basic-usage)
    - [Installing Basic Usage Dependencies](#installing-basic-usage-dependencies)
    - [Basic Usage Example](#basic-usage-example)
  - [Usage with a Contract](#usage-with-a-contract)
    - [Installing Usage with a Contract Dependencies](#installing-usage-with-a-contract-dependencies)
    - [Usage with a Contract Example](#usage-with-a-contract-example)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Additional Resources](#additional-resources)

## Introduction

Custom providers for Silent Data [Rollup], compatible with ethers.js.

## Prerequisites

- Node.js (version 18 or higher)
- npm
- Basic knowledge of Ethereum and smart contracts
- Ethers.js v6

## Integration

### Basic Usage

#### Installing Basic Usage Dependencies

```bash
npm install @appliedblockchain/silentdatarollup-core @appliedblockchain/silentdatarollup-ethers-provider ethers@6
```

#### Basic Usage Example

```typescript
import { NetworkName } from '@appliedblockchain/silentdatarollup-core'
import {
  NetworkName,
  SilentDataRollupProvider,
} from '@appliedblockchain/silentdatarollup-ethers-provider'
import { Wallet } from 'ethers'

const providerConfig = {
  rpcUrl: 'SILENT_DATA_ROLLUP_RPC_URL',
  network: NetworkName.TESTNET,
  privateKey: 'YOUR_PRIVATE_KEY',
}

const provider = new SilentDataRollupProvider(providerConfig)

const balance = await provider.getBalance('YOUR_ADDRESS')
console.log(balance)
```

### Usage with a Contract

#### Installing Usage with a Contract Dependencies

```bash
npm install @appliedblockchain/silentdatarollup-core @appliedblockchain/silentdatarollup-ethers-provider ethers@6
```

#### Usage with a Contract Example

```typescript
import {
  ChainId,
  SilentDataRollupContract,
} from '@appliedblockchain/silentdatarollup-core'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { ethers } from 'ethers'

const providerConfig = {
  rpcUrl: 'SILENT_DATA_ROLLUP_RPC_URL',
  network: NetworkName.TESTNET,
  privateKey: 'YOUR_PRIVATE_KEY',
}

const provider = new SilentDataRollupProvider(providerConfig)

const contractAddress = 'YOUR_CONTRACT_ADDRESS'
const abi = [
  /* Your contract ABI */
]
const methodsToSign = ['method1', 'method2'] // Contract read calls that require signing

const contract = new SilentDataRollupContract(
  contractAddress,
  abi,
  provider,
  methodsToSign,
)

// Now you can call "private" contract methods. These calls will be signed,
// and msg.sender will be available in the contract, representing the signer's address.
const privateMethodResult = await contract.method1('param1', 'param2')
console.log('Private method result:', privateMethodResult)

// You can also call methods that don't require signing.
// These calls won't include a signature, and msg.sender won't be available in the contract.
const publicMethodResult = await contract.method3('param1', 'param2')
console.log('Public method result:', publicMethodResult)
```

## License

This project is licensed under the [MIT License](LICENSE).

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure you're using the correct RPC URL for your desired network.
2. Verify that your private key is correctly set.
3. Ensure that your token is active on the SilentData AppChains dashboard.

## Additional Resources

- [Silent Data [Rollup] Documentation](https://docs.silentdata.com)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
