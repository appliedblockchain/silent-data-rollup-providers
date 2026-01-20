# Silent Data Providers - Ethers Provider Package

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
  - [Private Events](#private-events)
    - [Overview](#overview)
    - [Using the SDInterface](#using-the-sdinterface)
    - [Private Events Example](#private-events-example)
  - [Smart Account Support](#smart-account-support)
    - [Smart Account Overview](#smart-account-overview)
    - [Smart Account Example](#smart-account-example)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Additional Resources](#additional-resources)

## Introduction

Custom providers for Silent Data, compatible with ethers.js.

## Prerequisites

- Node.js (version 18 or higher)
- pnpm
- Basic knowledge of Ethereum and smart contracts
- Ethers.js v6

## Integration

### Basic Usage

#### Installing Basic Usage Dependencies

```bash
pnpm add @appliedblockchain/silentdatarollup-core @appliedblockchain/silentdatarollup-ethers-provider ethers@6
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
pnpm add @appliedblockchain/silentdatarollup-core @appliedblockchain/silentdatarollup-ethers-provider ethers@6
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
const balance = await provider.getBalance('YOUR_ADDRESS')
console.log(balance)

const contractConfig = {
  contractAddress: 'YOUR_CONTRACT_ADDRESS'
  abi: [ /* Your contract ABI */ ],
  runner: provider,
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

### Private Events

#### Overview

Silent Data Rollup supports Private Events, which are blockchain events that are only visible to authorized users. The `SilentDataRollupProvider` includes specialized methods for working with these private events:

- `getAllLogs()` - Returns both regular and private events
- `getPrivateLogs()` - Returns only private events

Private events are wrapped in a `PrivateEvent` event with the following structure:

```solidity
event PrivateEvent(
  address[] allowedViewers,
  bytes32 indexed eventType,
  bytes payload
);
```

#### Using the SDInterface

To easily decode private events, use the `SDInterface` class which extends ethers' `Interface`:

1. Create an `SDInterface` instance with your contract ABI plus **the private additional event signatures**
2. Use it to parse logs from `getAllLogs()` or `getPrivateLogs()`
3. Access the decoded inner event via the `innerLog` property of the parsed log

#### Private Events Example

```typescript
import {
  SDInterface,
  SilentDataRollupProvider,
} from '@appliedblockchain/silentdatarollup-ethers-provider'

// Initialize provider
const provider = new SilentDataRollupProvider({
  rpcUrl: 'SILENT_DATA_ROLLUP_RPC_URL',
  network: NetworkName.TESTNET,
  privateKey: 'YOUR_PRIVATE_KEY',
})

// Contract ABI with PrivateEvent definition
const contractAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address[]',
        name: 'allowedViewers',
        type: 'address[]',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'eventType',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'payload',
        type: 'bytes',
      },
    ],
    name: 'PrivateEvent',
    type: 'event',
  },
  // Your other contract events and functions...
]

// Create SDInterface with contract ABI and any additional event signatures
const sdInterface = new SDInterface([
  ...contractAbi,
  // Note: The private event doesn't have indexed params.
  // Add any other event signatures that might be emitted privately
  'event TransferPrivate(address from, address to, uint256 value)',
])

// Get private events
const privateEvents = await provider.getPrivateLogs({
  address: 'YOUR_CONTRACT_ADDRESS',
  // Optional: Filter by specific event type
  eventSignature: 'TransferPrivate(address,address,uint256)',
})

// Parse and access private events
for (const log of privateEvents) {
  const parsedLog = sdInterface.parseLog(log)

  console.log('Private Event:', parsedLog.name) // Will be 'PrivateEvent'
  console.log('Private Args:', parsedLog.args) // Raw PrivateEvent args

  // Access the decoded inner event
  if (parsedLog.innerLog) {
    console.log('Decoded Private Event:', parsedLog.innerLog.name) // e.g., 'TransferPrivate'
    console.log('Decoded Private Args:', parsedLog.innerLog.args) // Decoded inner event args

    // Access args by name
    const { from, to, value } = parsedLog.innerLog.args
    console.log(`Transfer from ${from} to ${to}: ${value}`)
  }
}
```

### Smart Account Support

#### Smart Account Overview

Silent Data Rollup supports smart accounts (smart wallet contracts) that implement [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271) for signature verification. When using a smart account, you provide the `smartWalletAddress` in the provider configuration, and the provider automatically handles signature verification through the smart contract.

**Key features:**

- **EIP-1271 Compatibility**: Your smart account contract must implement the `isValidSignature(bytes32 hash, bytes signature)` function
- **Automatic Hash Signing**: When `smartWalletAddress` is provided, the provider signs the hash of messages for proper EIP-1271 verification
- **Flexible Signer Support**: Works with any signer implementation, including passkey signers, browser wallets, and more

#### Smart Account Example

This example shows how to use the provider with a passkey signer and smart account. For a complete passkey implementation, see the [Giano repository](https://github.com/appliedblockchain/giano).

```typescript
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { NetworkName } from '@appliedblockchain/silentdatarollup-core'
// Example: Using Giano passkey signer
// See https://github.com/appliedblockchain/giano for full implementation
import { GianoSigner } from '@appliedblockchain/giano-client'

// Initialize your Giano passkey signer
const gianoSigner = await GianoSigner.create({
  // Passkey configuration
})

// Configure provider with smart account
const providerConfig = {
  rpcUrl: 'SILENT_DATA_ROLLUP_RPC_URL',
  network: NetworkName.TESTNET,
  signer: gianoSigner,
  // Provide your EIP-1271 compatible smart account address
  smartWalletAddress: '0xYOUR_SMART_ACCOUNT_ADDRESS',
}

const provider = new SilentDataRollupProvider(providerConfig)

// Use the provider as normal
// All signatures will be verified via your smart account's EIP-1271 implementation
const balance = await provider.getBalance('YOUR_ADDRESS')
console.log(balance)

// Works with contracts too
const contractConfig = {
  contractAddress: 'YOUR_CONTRACT_ADDRESS',
  abi: [
    /* Your contract ABI */
  ],
  runner: provider,
  methodsToSign: ['privateMethod'],
}

const contract = new SilentDataRollupContract(contractConfig)
const result = await contract.privateMethod('param')
```

**Note**: Your smart account contract must implement EIP-1271's `isValidSignature` function to verify signatures. The provider will automatically sign message hashes when `smartWalletAddress` is configured, ensuring compatibility with the EIP-1271 standard.

## License

This project is licensed under the [MIT License](LICENSE).

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure you're using the correct RPC URL for your desired network.
2. Verify that your private key is correctly set.
3. Ensure that your token is active on the SilentData AppChains dashboard.

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
