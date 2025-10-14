# Silent Data Providers - Hardhat Plugin Package

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

Custom providers for integrating Silent Data with Hardhat.

## Prerequisites

- Node.js (version 18 or higher)
- Hardhat v2
- npm
- Basic knowledge of Ethereum and smart contracts

## Integration

### Hardhat Integration

#### Installing Hardhat Integration Dependencies

```bash
npm install @appliedblockchain/silentdatarollup-hardhat-plugin @nomicfoundation/hardhat-ignition-ethers@0.15.7
```

#### Hardhat Integration Example

To integrate the Silent Data Provider with Hardhat, you need to configure your Silent Data network in the `hardhat.config.ts` file. Below is an example of how to set it up, and note that a `silentdata` property is needed on the network config to enable it. This property can be an empty object to apply defaults, or you can specify the configurations.

```typescript
import '@nomicfoundation/hardhat-ignition-ethers'
import '@appliedblockchain/silentdatarollup-hardhat-plugin'

const RPC_URL = 'SILENT_DATA_ROLLUP_RPC_URL'
const PRIVATE_KEY = process.env.PRIVATE_KEY

export default {
  solidity: '0.8.21',
  defaultNetwork: 'sdr',
  networks: {
    sdr: {
      url: RPC_URL,
      accounts: [PRIVATE_KEY], // Note: Currently, only one private key can be passed to the network accounts configuration.
      silentdata: {
        authSignatureType: SignatureType.EIP712, // Optional, defaults to RAW
      },
    },
  },
}
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

## License

This project is licensed under the [MIT License](LICENSE).

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Hardhat Ignition](https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-ignition)
