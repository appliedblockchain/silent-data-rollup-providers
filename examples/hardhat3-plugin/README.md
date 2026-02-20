# Silent Data Hardhat 3 Plugin Example

This repository demonstrates how to use the `@appliedblockchain/silentdatarollup-hardhat3-plugin` with a Hardhat 3 project. The example includes a basic smart contract deployment setup using Hardhat Ignition.

> **Note:** This example is for Hardhat 3. For Hardhat 2, see the `examples/hardhat-plugin` directory.

## Prerequisites

- Node.js (version 22 or higher)
- pnpm
- Access to a Silent Data RPC endpoint

## Getting Started

1. Clone the repository:

   ```bash
   git clone <repo-folder>
   cd <repo-folder>
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build packages:

   ```bash
   pnpm build
   ```

4. Navigate to the example directory and install dependencies:

   ```bash
   cd examples/hardhat3-plugin
   pnpm install
   ```

## Configuration

The project is configured in `hardhat.config.ts` to use the Silent Data network:

```typescript
import { configVariable, defineConfig } from 'hardhat/config'
import hardhatIgnitionViemPlugin from '@nomicfoundation/hardhat-ignition-viem'
import silentDataPlugin from '@appliedblockchain/silentdatarollup-hardhat3-plugin'
import { SignatureType } from '@appliedblockchain/silentdatarollup-core'

export default defineConfig({
  plugins: [silentDataPlugin, hardhatIgnitionViemPlugin],
  solidity: '0.8.22',
  networks: {
    sdr: {
      type: 'http',
      url: configVariable('RPC_URL'),
      accounts: [configVariable('PRIVATE_KEY')],
      silentdata: {
        authSignatureType: SignatureType.Raw,
      },
    },
  },
})
```

`configVariable()` defines values that are resolved at runtime. By default, Configuration Variables are read from environment variables, but plugins like `hardhat-keystore` can define alternative ways to obtain their values.

For more details, see the [Hardhat 3 Configuration Variables guide](https://hardhat.org/docs/guides/configuration-variables#using-configuration-variables).

## Smart Contracts

The example includes a simple `PrivateToken.sol` contract that implements a privacy-focused ERC-20 token with the following features:

- Implements the ERC-20 standard interface
- Only allows token holders to view their own balance through the `balanceOf` method

These is also a very basic contract example called `SimpleContract`.

## Deployment - PrivateToken

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/PrivateToken.ts`.

To deploy the contract:

```bash
RPC_URL=${RPC_URL} PRIVATE_KEY=${PRIVATE_KEY} pnpm deploy:private-token
```

This will:

1. Compile the PrivateToken contract
2. Deploy it to the Silent Data network

## Deployment - PrivateEvents

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/PrivateEvents.ts`.

To deploy the contract:

```bash
RPC_URL=${RPC_URL} PRIVATE_KEY=${PRIVATE_KEY} pnpm deploy:private-events
```

This will:

1. Compile the PrivateEvents contract
2. Deploy it to the Silent Data network

## Deployment - SimpleContract

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/SimpleContract.ts`.

To deploy the contract:

```bash
RPC_URL=${RPC_URL} PRIVATE_KEY=${PRIVATE_KEY} pnpm deploy:simple-contract
```

This will:

1. Compile the SimpleContract contract
2. Deploy it to the Silent Data network

## Development

### Available Scripts

- `pnpm compile` - Compile all contracts
- `pnpm deploy:private-token` - Deploy the PrivateToken contract using Hardhat Ignition
- `pnpm deploy:private-events` - Deploy the PrivateEvents contract using Hardhat Ignition
- `pnpm deploy:simple-contract` - Deploy the SimpleContract contract using Hardhat Ignition

### Project Dependencies

Main dependencies include:

- `@appliedblockchain/silentdatarollup-hardhat3-plugin`: Enables Silent Data integration for Hardhat 3
- `@nomicfoundation/hardhat-ignition-ethers`: Provides deployment management
- `hardhat`: The core development environment (v3)

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Hardhat 3 Documentation](https://hardhat.org/docs/getting-started)
- [Hardhat Ignition Guide](https://hardhat.org/ignition/docs/getting-started)
