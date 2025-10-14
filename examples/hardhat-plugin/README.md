# Silent Data Hardhat Plugin Example

This repository demonstrates how to use the `@appliedblockchain/silentdatarollup-hardhat-plugin` with a Hardhat project. The example includes a basic smart contract deployment setup using Hardhat Ignition.

## Prerequisites

- Node.js (version 18 or higher)
- npm
- Access to a Silent Data RPC endpoint

## Getting Started

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd examples/hardhat-plugin
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory by copying the provided `.env.example` file and updating your environment variables:

   ```plaintext
   PRIVATE_KEY=<your_private_key>
   RPC_URL=<your_rpc_url>
   ```

## Configuration

The project is configured in `hardhat.config.ts` to use the Silent Data Rollup network:

```typescript
{
  defaultNetwork: "sdr",
  networks: {
    sdr: {
      url: RPC_URL,
      accounts: [PRIVATE_KEY],
      silentdata: {},  // Enable Silent Data Rollup features
    },
  }
}
```

## Smart Contracts

The example includes a simple `PrivateToken.sol` contract that implements a privacy-focused ERC20 token with the following features:

- Implements the ERC20 standard interface
- Only allows token holders to view their own balance through the `balanceOf` method

These is also a very basic contract example called `SimpleContract`.

## Deployment - PrivateToken

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/PrivateToken.ts`.

To deploy the contract:

```bash
npm run deploy:private-token
```

This will:

1. Compile the PrivateToken contract
2. Deploy it to the Silent Data network

## Deployment - PrivateEvents

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/PrivateEvents.ts`.

To deploy the contract:

```bash
npm run deploy:private-events
```

This will:

1. Compile the PrivateEvents contract
2. Deploy it to the Silent Data network

## Deployment - SimpleContract

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/SimpleContract.ts`.

To deploy the contract:

```bash
npm run deploy:simple-contract
```

This will:

1. Compile the SimpleContract contract
2. Deploy it to the Silent Data network

## Development

### Available Scripts

- `npm run compile` - Compile all contracts
- `npm run deploy:private-token` - Deploy the PrivateToken contract using Hardhat Ignition
- `npm run deploy:private-events` - Deploy the PrivateEvents contract using Hardhat Ignition
- `npm run deploy:simple-contract` - Deploy the SimpleContract contract using Hardhat Ignition

### Project Dependencies

Main dependencies include:

- `@appliedblockchain/silentdatarollup-hardhat-plugin`: Enables Silent Data integration
- `@nomicfoundation/hardhat-ignition-ethers`: Provides deployment management
- `hardhat`: The core development environment

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Hardhat Ignition Guide](https://hardhat.org/ignition/docs/getting-started)
