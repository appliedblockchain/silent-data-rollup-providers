# Silent Data Providers - Viem Fireblocks Transport Package

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Integration](#integration)
  - [Basic Usage](#basic-usage)
    - [Installing Dependencies](#installing-dependencies)
    - [Basic Usage Example](#basic-usage-example)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Additional Resources](#additional-resources)

## Introduction

Viem custom transport for Silent Data with Fireblocks integration. This package allows you to use Fireblocks for transaction signing while interacting with the Silent Data Rollup network using the viem library.

## Prerequisites

- Node.js (version 18 or higher)
- pnpm
- Basic knowledge of Ethereum and smart contracts
- Viem
- A Fireblocks account with API credentials

## Integration

### Basic Usage

#### Installing Dependencies

```bash
pnpm add @appliedblockchain/silentdatarollup-viem-fireblocks
```

#### Basic Usage Example

```typescript
import { defineChain, createPublicClient, createWalletClient } from 'viem'
import { ApiBaseUrl, ChainId } from '@fireblocks/fireblocks-web3-provider'
import { sdFireblocksTransport } from '@appliedblockchain/silentdatarollup-viem-fireblocks'

const config = {
  rpcUrl: 'SILENT_DATA_ROLLUP_RPC_URL',
  chainId: 'SILENT_DATA_CHAIN_ID',
  fireblocksApiKey: 'YOUR_FIREBLOCKS_API_KEY',
  fireblocksPrivateKey: 'YOUR_FIREBLOCKS_PRIVATE_KEY_PATH',
  fireblocksVaultAccountId: 'YOUR_FIREBLOCKS_VAULT_ACCOUNT_ID',
}

const transport = sdFireblocksTransport({
  apiKey: config.fireblocksApiKey,
  privateKey: config.fireblocksPrivateKey,
  vaultAccountIds: config.fireblocksVaultAccountId,
  chainId: ChainId.SEPOLIA,
  apiBaseUrl: ApiBaseUrl.Sandbox, // Change to ApiBaseUrl.Production for production
  rpcUrl: config.rpcUrl,
})

const sdChain = defineChain({
  id: config.chainId,
  name: 'SILENT_DATA_CHAIN_NAME',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [config.rpcUrl],
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
})

// Get accounts from Fireblocks
const [walletAddress] = await walletClient.getAddresses()

// Get balance
const balance = await publicClient.getBalance({ address: walletAddress })
console.log('Balance:', balance)

const recipientAddress = 'RECIPIENT_ADDRESS'
const amountInWei = BigInt('1')

// Send transaction (signed via Fireblocks)
const transactionHash = await walletClient.sendTransaction({
  account: walletAddress,
  to: recipientAddress,
  value: amountInWei,
})
console.log('Transaction Hash:', transactionHash)
```

## License

This project is licensed under the [MIT License](LICENSE).

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure your Fireblocks API credentials are correct and have the necessary permissions.
2. Verify that your vault account ID is correctly configured.
3. Ensure you're using the correct RPC URL for your desired network.
4. Ensure that your token is active on the SilentData AppChains dashboard.
5. Check that your Fireblocks account has sufficient funds for transactions.

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Viem Documentation](https://viem.sh/docs/)
- [Fireblocks Web3 Provider Documentation](https://developers.fireblocks.com/docs/ethereum-web3-provider)
