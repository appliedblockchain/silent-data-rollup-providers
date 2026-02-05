# dApp Development Guide

Complete guide to building decentralized applications on Silent Data.

## Provider Options

| Package                                                          | Use Case                                |
| ---------------------------------------------------------------- | --------------------------------------- |
| `@appliedblockchain/silentdatarollup-ethers-provider`            | ethers.js v6 applications               |
| `@appliedblockchain/silentdatarollup-viem`                       | viem-based applications                 |
| `@appliedblockchain/silentdatarollup-ethers-provider-fireblocks` | Enterprise ethers.js with Fireblocks    |
| `@appliedblockchain/silentdatarollup-viem-fireblocks`            | Enterprise viem with Fireblocks custody |

## ethers.js Integration

### Installation

```bash
npm install @appliedblockchain/silentdatarollup-ethers-provider ethers@6
```

### Basic Provider Setup

> **Note**: Private keys must include the `0x` prefix (66 characters total).

```typescript
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { NetworkName } from '@appliedblockchain/silentdatarollup-core'

const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  network: NetworkName.TESTNET, // or NetworkName.MAINNET
  privateKey: '0x...', // 64 hex chars after 0x prefix
})

// Use like any ethers provider
const balance = await provider.getBalance('0x...')
const blockNumber = await provider.getBlockNumber()
```

### With External Signer (MetaMask)

```typescript
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { BrowserProvider } from 'ethers'

// Get signer from MetaMask
const browserProvider = new BrowserProvider(window.ethereum)
const signer = await browserProvider.getSigner()

const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  signer: signer, // Pass external signer
})
```

### Contract Interaction with Private Methods

```typescript
import {
  SilentDataRollupProvider,
  SilentDataRollupContract,
} from '@appliedblockchain/silentdatarollup-ethers-provider'

const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  privateKey: 'YOUR_PRIVATE_KEY',
})

// For contracts with private read methods
const contract = new SilentDataRollupContract({
  address: '0x1234...',
  abi: [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address, uint256) returns (bool)',
    'function name() view returns (string)',
  ],
  runner: provider.signer, // Must use signer, not provider directly
  contractMethodsToSign: ['balanceOf'], // These methods need signing
})

// Private method - will be signed, msg.sender available
const myBalance = await contract.balanceOf(myAddress)

// Public method - no signing needed
const tokenName = await contract.name()

// Write method - always signed (standard behavior)
const tx = await contract.transfer(recipient, amount)
await tx.wait()
```

### Signature Types

```typescript
import { SignatureType } from '@appliedblockchain/silentdatarollup-core'

const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  privateKey: 'YOUR_PRIVATE_KEY',
  authSignatureType: SignatureType.EIP712, // Options: Raw, EIP191, EIP712
})
```

### Always Sign All Reads (`alwaysSignEthCalls`)

By default, only methods listed in `contractMethodsToSign` are signed. Use `alwaysSignEthCalls` when:

- **Contract has many private methods** - simpler than listing every method
- **Simulating ETH transfers** - no contract or method, but you need `msg.sender` available
- **Unknown contracts** - interacting with contracts where you don't know which methods need signing

```typescript
const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  privateKey: '0x...',
  alwaysSignEthCalls: true, // Signs ALL eth_call requests
})

// Now every read operation includes authentication headers
// No need to specify contractMethodsToSign on individual contracts

// Example: Simulate an ETH transfer (no contract)
// msg.sender will be your address, not a random address
const result = await provider.call({
  to: '0xRecipient...',
  value: parseEther('1.0'),
})

// Example: Read from any contract - all calls signed automatically
const contract = new Contract(address, abi, provider.signer)
const balance = await contract.balanceOf(myAddress) // Signed automatically
```

**Trade-off:** Slightly more overhead since even public reads are signed. Use `contractMethodsToSign` for fine-grained control when performance matters.

## viem Integration

### Installation

```bash
npm install @appliedblockchain/silentdatarollup-viem viem
```

### Basic Setup

```typescript
import { createPublicClient, createWalletClient, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sdTransport } from '@appliedblockchain/silentdatarollup-viem'

// Define the Silent Data chain
const silentDataTestnet = defineChain({
  id: 381185,
  name: 'Silent Data Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['YOUR_RPC_URL'],
    },
  },
})

// Create the Silent Data transport
const transport = sdTransport({
  rpcUrl: 'YOUR_RPC_URL',
  chainId: 381185,
  privateKey: '0x...',
})

// Create clients
const publicClient = createPublicClient({
  chain: silentDataTestnet,
  transport,
})

const account = privateKeyToAccount('0x...')
const walletClient = createWalletClient({
  chain: silentDataTestnet,
  transport,
  account,
})
```

### Reading and Writing

```typescript
// Read balance
const balance = await publicClient.getBalance({
  address: account.address,
})

// Send transaction
const hash = await walletClient.sendTransaction({
  to: '0x...',
  value: parseEther('0.1'),
})

// Wait for confirmation
const receipt = await publicClient.waitForTransactionReceipt({ hash })
```

### Contract Interaction

> **Note:** Viem contract interaction with private methods is experimental. For production use cases requiring `contractMethodsToSign` granularity, consider using the ethers.js provider with `SilentDataRollupContract`.

```typescript
import { getContract, parseAbi } from 'viem'

const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
])

const contract = getContract({
  address: '0x...',
  abi,
  client: { public: publicClient, wallet: walletClient },
})

// Read (signed via transport if configured)
const balance = await contract.read.balanceOf([account.address])

// Write
const hash = await contract.write.transfer(['0x...', 1000n])
```

## Viem with Fireblocks Integration

For enterprise applications using Fireblocks custody with viem.

### Installation

```bash
npm install @appliedblockchain/silentdatarollup-viem-fireblocks viem @fireblocks/fireblocks-web3-provider
```

### Setup

```typescript
import { createPublicClient, createWalletClient, defineChain } from 'viem'
import { ApiBaseUrl, ChainId } from '@fireblocks/fireblocks-web3-provider'
import { sdFireblocksTransport } from '@appliedblockchain/silentdatarollup-viem-fireblocks'

// Define the Silent Data chain
const silentDataChain = defineChain({
  id: 381185, // Testnet
  name: 'Silent Data Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['YOUR_RPC_URL'],
    },
  },
})

// Create the Fireblocks transport
const transport = sdFireblocksTransport({
  apiKey: process.env.FIREBLOCKS_API_KEY!,
  privateKey: process.env.FIREBLOCKS_PRIVATE_KEY!, // Path to your Fireblocks private key file
  vaultAccountIds: process.env.FIREBLOCKS_VAULT_ACCOUNT_ID!,
  chainId: ChainId.SEPOLIA, // Fireblocks chain ID
  apiBaseUrl: ApiBaseUrl.Sandbox, // Use ApiBaseUrl.Production for mainnet
  rpcUrl: 'YOUR_RPC_URL',
})

// Create clients
const publicClient = createPublicClient({
  chain: silentDataChain,
  transport,
})

const walletClient = createWalletClient({
  chain: silentDataChain,
  transport,
})
```

### Usage

```typescript
// Get wallet address from Fireblocks
const [walletAddress] = await walletClient.getAddresses()

// Read balance
const balance = await publicClient.getBalance({ address: walletAddress })
console.log('Balance:', balance)

// Send transaction (signed via Fireblocks)
const hash = await walletClient.sendTransaction({
  account: walletAddress,
  to: '0x...',
  value: parseEther('0.1'),
})

// Wait for confirmation
const receipt = await publicClient.waitForTransactionReceipt({ hash })
```

### Contract Interaction

```typescript
import { getContract, parseAbi } from 'viem'

const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
])

const contract = getContract({
  address: '0x...',
  abi,
  client: { public: publicClient, wallet: walletClient },
})

// Read
const balance = await contract.read.balanceOf([walletAddress])

// Write (signed via Fireblocks)
const hash = await contract.write.transfer(['0x...', 1000n])
```

### Fireblocks Configuration

| Config            | Description                                     |
| ----------------- | ----------------------------------------------- |
| `apiKey`          | Your Fireblocks API key                         |
| `privateKey`      | Path to Fireblocks private key file             |
| `vaultAccountIds` | Fireblocks vault account ID(s)                  |
| `chainId`         | Fireblocks chain ID (e.g., `ChainId.SEPOLIA`)   |
| `apiBaseUrl`      | `ApiBaseUrl.Sandbox` or `ApiBaseUrl.Production` |
| `rpcUrl`          | Silent Data RPC URL                             |

## Smart Account Support (EIP-1271)

For smart wallets that verify signatures on-chain:

```typescript
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'

const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  signer: passkeyOrExternalSigner,
  smartWalletAddress: '0xYourSmartWalletAddress', // EIP-1271 compatible
})

// Signatures will be verified via your smart wallet's isValidSignature
```

## React Integration Example

```typescript
// hooks/useSilentDataProvider.ts
import { useState, useEffect } from 'react'
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'
import { BrowserProvider } from 'ethers'

export function useSilentDataProvider() {
  const [provider, setProvider] = useState<SilentDataRollupProvider | null>(
    null,
  )
  const [address, setAddress] = useState<string | null>(null)

  async function connect() {
    if (!window.ethereum) {
      throw new Error('No wallet found')
    }

    const browserProvider = new BrowserProvider(window.ethereum)
    const signer = await browserProvider.getSigner()
    const address = await signer.getAddress()

    const sdProvider = new SilentDataRollupProvider({
      rpcUrl: process.env.NEXT_PUBLIC_RPC_URL!,
      signer,
    })

    setProvider(sdProvider)
    setAddress(address)
  }

  return { provider, address, connect }
}
```

```tsx
// components/PrivateBalance.tsx
import { useState, useEffect } from 'react'
import { formatEther } from 'ethers'
import { useSilentDataProvider } from '../hooks/useSilentDataProvider'
import { SilentDataRollupContract } from '@appliedblockchain/silentdatarollup-ethers-provider'

function PrivateBalance({ tokenAddress }: { tokenAddress: string }) {
  const { provider, address } = useSilentDataProvider()
  const [balance, setBalance] = useState<string>('--')

  useEffect(() => {
    if (!provider || !address) return

    const contract = new SilentDataRollupContract({
      address: tokenAddress,
      abi: ['function balanceOf(address) view returns (uint256)'],
      runner: provider,
      contractMethodsToSign: ['balanceOf'],
    })

    contract.balanceOf(address).then((bal) => {
      setBalance(formatEther(bal))
    })
  }, [provider, address, tokenAddress])

  return <div>Your private balance: {balance}</div>
}
```

## Network Configuration

| Network | Chain ID | NetworkName           |
| ------- | -------- | --------------------- |
| Mainnet | 380929   | `NetworkName.MAINNET` |
| Testnet | 381185   | `NetworkName.TESTNET` |

Get RPC URLs from the [Silent Data Dashboard](https://www.silentdata.com/).

## Error Handling

```typescript
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'

const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  privateKey: 'YOUR_PRIVATE_KEY',
})

try {
  const balance = await contract.balanceOf(someAddress)
} catch (error) {
  if (error.message.includes('UnauthorizedBalanceQuery')) {
    // User tried to read someone else's balance
    console.log('You can only view your own balance')
  } else if (error.message.includes('reverted')) {
    // Contract reverted
    console.log('Transaction reverted:', error.reason)
  } else {
    // Network or other error
    console.error('Error:', error)
  }
}
```

## Testing Your dApp

### Local Development

Use a testnet endpoint for development:

```typescript
const provider = new SilentDataRollupProvider({
  rpcUrl: process.env.TESTNET_RPC_URL,
  network: NetworkName.TESTNET,
  privateKey: process.env.DEV_PRIVATE_KEY,
})
```

### Unit Tests with Mock

```typescript
// For unit tests, you can mock the provider
jest.mock('@appliedblockchain/silentdatarollup-ethers-provider', () => ({
  SilentDataRollupProvider: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(BigInt(1000)),
    // ... other methods
  })),
}))
```

## Debugging

### Enable Debug Logs

```typescript
// Set environment variable
DEBUG=silentdata:* node your-app.js
```

### Common Issues

1. **"Signature verification failed"**: Check your private key matches your account
2. **"Method not signed"**: Add the method to `contractMethodsToSign`
3. **"RPC URL invalid"**: Verify URL from dashboard, check API token is active
4. **"Chain ID mismatch"**: Ensure chain ID matches network (testnet vs mainnet)
