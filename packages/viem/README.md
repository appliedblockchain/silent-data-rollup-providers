# Silent Data Providers - Viem Transport Package

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Integration](#integration)
  - [Basic Usage](#basic-usage)
    - [Installing Basic Usage Dependencies](#installing-basic-usage-dependencies)
    - [Basic Usage Example](#basic-usage-example)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Additional Resources](#additional-resources)

## Introduction

Viem custom transport for Silent Data.

## Prerequisites

- Node.js (version 18 or higher)
- pnpm
- Basic knowledge of Ethereum and smart contracts
- Viem

## Integration

### Basic Usage

#### Installing Basic Usage Dependencies

```bash
pnpm add @appliedblockchain/silentdatarollup-viem
```

#### Basic Usage Example

```typescript
import { defineChain, createPublicClient, createWalletClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sdTransport } from '@appliedblockchain/silentdatarollup-viem'

const providerConfig = {
  rpcUrl: 'SILENT_DATA_ROLLUP_RPC_URL',
  chainId: 'SILENT_DATA_CHAIN_ID',
  privateKey: 'YOUR_PRIVATE_KEY',
}

const account = privateKeyToAccount(providerConfig.privateKey)

const transport = sdTransport(providerConfig)

const sdChain = defineChain({
  id: providerConfig.chainId,
  name: 'SILENT_DATA_CHAIN_NAME',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [providerConfig.rpcUrl],
    },
  },
})

const publicClient = createPublicClient({
  chain: sdChain,
  transport,
})

const walletClient = createWalletClient({
  chain: sdChain,
  transport,
  account,
})

const balance = await publicClient.getBalance({ address: account.address })
console.log('Balance:', balance)

const transactionCount = await publicClient.getTransactionCount({
  address: account.address,
})
console.log('Transaction count:', transactionCount)

const recipientAddress = 'RECIPIENT_ADDRESS'
const amountInWei = BigInt('1')

const transactionHash = await walletClient.sendTransaction({
  to: recipientAddress,
  value: amountInWei,
})
console.log('Transaction Hash:', transactionHash)
```

## License

This project is licensed under the [MIT License](LICENSE).

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure you're using the correct RPC URL for your desired network.
2. Verify that your private key is correctly set.
3. Ensure that your token is active on the SilentData AppChains dashboard.

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Viem Documentation](https://viem.sh/docs/)
