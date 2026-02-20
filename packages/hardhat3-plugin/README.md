# Silent Data Providers - Hardhat 3 Plugin Package

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Integration](#integration)
  - [Hardhat Integration](#hardhat-integration)
    - [Installing Hardhat Integration Dependencies](#installing-hardhat-integration-dependencies)
    - [Hardhat Integration Example](#hardhat-integration-example)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Additional Resources](#additional-resources)

## Introduction

Custom providers for integrating Silent Data with Hardhat 3.

> **Note:** This plugin is for Hardhat 3. For Hardhat 2, use `@appliedblockchain/silentdatarollup-hardhat-plugin`.

## Prerequisites

- Node.js (version 22 or higher)
- Hardhat v3
- pnpm
- Basic knowledge of Ethereum and smart contracts

## Integration

### Hardhat Integration

#### Installing Hardhat Integration Dependencies

```bash
pnpm add @appliedblockchain/silentdatarollup-hardhat3-plugin @nomicfoundation/hardhat-ignition-viem
```

#### Hardhat Integration Example

To integrate the Silent Data Provider with Hardhat 3, you need to:

1. Import and add the plugin to the `plugins` array (Hardhat 3's declarative pattern)
2. Configure your Silent Data network with the `silentdata` property

Note that Hardhat 3 uses ESM by default and requires a declarative configuration.

```typescript
import { defineConfig } from 'hardhat/config'
import hardhatIgnitionViemPlugin from '@nomicfoundation/hardhat-ignition-viem'
import { SignatureType } from '@appliedblockchain/silentdatarollup-core'
import silentDataPlugin from '@appliedblockchain/silentdatarollup-hardhat3-plugin'

const RPC_URL = 'SILENT_DATA_ROLLUP_RPC_URL'
const PRIVATE_KEY = process.env.PRIVATE_KEY

export default defineConfig({
  plugins: [silentDataPlugin],
  solidity: '0.8.21',
  networks: {
    sdr: {
      type: 'http',
      url: RPC_URL,
      accounts: [PRIVATE_KEY], // Note: Currently, only one private key can be passed to the network accounts configuration.
      silentdata: {
        authSignatureType: SignatureType.EIP712, // Optional, defaults to RAW
      },
    },
  },
})
```

Note: With the above configuration, you can deploy a contract using Hardhat Ignition. For a detailed example, including a sample contract and an Ignition module, please refer to the [Hardhat Ignition Getting Started Guide](https://hardhat.org/ignition/docs/getting-started).

To deploy your contract using Hardhat Ignition, run the following command:

```bash
npx hardhat ignition deploy ignition/modules/Apollo.ts --network sdr
```

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure you're using the correct RPC URL for your desired network.
2. Verify that your private key is correctly set.
3. Ensure that your token is still active on the SilentData AppChains dashboard.
4. Make sure your Hardhat config file uses ESM syntax (Hardhat 3 requirement).
5. Make sure you're using Node.js v22.10.0 or later (Hardhat 3 requirement).

## License

This project is licensed under the [MIT License](LICENSE).

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Hardhat 3 Documentation](https://hardhat.org/docs/hardhat3/whats-new)
- [Hardhat 3 Plugin Development](https://hardhat.org/docs/plugin-development)
- [Hardhat Ignition](https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-ignition)
