# Silent Data Rollup Viem Plugin

A [viem](https://viem.sh) transport plugin for Silent Data Rollup that enables seamless integration with Silent Data's RPC infrastructure.

## Features

- 🔌 Custom viem transport for Silent Data RPC
- 🔒 Automatic request signing with session management
- 🔄 Concurrent request handling
- 🛠 Configurable network and signature settings
- 🤝 [Wagmi](https://wagmi.sh) compatibility

## Installation

```bash
npm install @appliedblockchain/silentdatarollup-viem-plugin
# or
yarn add @appliedblockchain/silentdatarollup-viem-plugin
# or
pnpm add @appliedblockchain/silentdatarollup-viem-plugin
```

## Usage

### Basic Setup

```typescript
import { createPublicClient } from 'viem'
import { sdt } from '@appliedblockchain/silentdatarollup-viem-plugin'

const client = createPublicClient({
  transport: sdt({
    rpcUrl: 'YOUR_RPC_URL',
    chainId: 1, // Your chain ID
  })
})
```

### With Configuration Options

```typescript
import { sdt, NetworkName } from '@appliedblockchain/silentdatarollup-viem-plugin'

const transport = sdt({
  rpcUrl: 'YOUR_RPC_URL',
  chainId: 1,
  delegate: true,
  network: NetworkName.MAINNET, // or your target network
  methodsToSign: ['getAssetId(uint256)'], // Contract methods that require signing
})
```

### Using with Wagmi

```typescript
import { WagmiConfig, createConfig, injected } from 'wagmi'
import { sdt, sd_testnet, SDProviderSession } from '@appliedblockchain/silentdatarollup-viem-plugin'

const chain = sd_testnet({
  chainId: 1,
  rpcUrl: 'https://rpc.testnet.silentdata.io'
})

const config = createConfig({
  chains: [chain],
  transports: {
    [chain.id]: sdt({
      chain,
      delegate: true,
      network: NetworkName.TESTNET,
      methodsToSign: ['balanceOf(address)']
    })
  },
  connectors: [ injected() ]
})

function App() {
  return (
    <WagmiConfig config={config}>
      <YourApp />
      <SDProviderSession />
    </WagmiConfig>
  )
}
```

### Understanding SDProviderSession

The `SDProviderSession` component is a crucial part of the Silent Data provider setup that handles:

1. **Wagmi Configuration Management**: Automatically syncs the Wagmi configuration with the Silent Data provider
2. **Session Management**: Resets the provider session when the user disconnects their wallet
3. **State Synchronization**: Ensures the provider state stays in sync with the wallet connection status

This component should be included in your app when using the Wagmi integration:

```typescript
function App() {
  return (
    <WagmiConfig config={config}>
      <YourApp />
      <SDProviderSession /> {/* Required for proper session management */}
    </WagmiConfig>
  )
}
```

> **Note**: Always include `SDProviderSession` as a child of `WagmiConfig` to ensure proper functionality of the Silent Data provider.

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `rpcUrl` | `string` | The RPC URL for Silent Data infrastructure |
| `chainId` | `number` | The chain ID to connect to |
| `delegate` | `boolean` | Enable delegation mode |
| `signatureType` | `SignatureType` | Type of signature to use ('EIP712', etc.) |
| `network` | `NetworkName` | Target network name |
| `methodsToSign` | `string[]` | Array of RPC methods that require signing |
| `chain` | `Chain` | Viem chain configuration object |
| `getSigner` | `() => Promise<{ getAddress: () => Promise<string>, signMessage: (message: string) => Promise<string> }>` | Custom signer function to override the default one |

## Features

### Automatic Session Management

The plugin automatically handles session management for signed requests, ensuring optimal performance and security.

### Concurrent Request Handling

Built-in request queuing and management for concurrent operations that require signed sessions.

### Custom Transport

Implements viem's custom transport interface with Silent Data specific optimizations and handling.

### Provider Instance

The plugin uses a singleton pattern for the `SilentDataRollupProvider`. All Silent Data transports share the same provider instance across your application, ensuring consistent state management and optimal resource usage. This means that configuration options like `rpcUrl`, `chainId`, and other settings will be shared across all transport instances.

### Custom Signer

You can provide your own signer implementation through the `getSigner` option:

```typescript
import { createPublicClient } from 'viem'
import { sdt } from '@appliedblockchain/silentdatarollup-viem-plugin'

const client = createPublicClient({
  transport: sdt({
    rpcUrl: 'YOUR_RPC_URL',
    chainId: 1,
    getSigner: async () => {
      // Your custom signer implementation
      return {
        getAddress: async () => '0x...',
        signMessage: async (message) => '0x...'
      }
    }
  })
})
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
