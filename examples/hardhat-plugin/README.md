# Silent Data Hardhat Plugin Example

This repository demonstrates how to use the `@appliedblockchain/silentdatarollup-hardhat-plugin` with a Hardhat project. The example includes a basic smart contract deployment setup using Hardhat Ignition.

> **Note:** This example is for Hardhat 2. For Hardhat 3, see the `examples/hardhat3-plugin` directory.

## Prerequisites

- Node.js (version 18 or higher)
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
   cd examples/hardhat-plugin
   pnpm install
   ```

5. Create a `.env` file by copying the provided `.env.example` file and updating your environment variables:

   ```plaintext
   PRIVATE_KEY=<your_private_key>
   RPC_URL=<your_rpc_url>
   ```

## Configuration

The project is configured in `hardhat.config.ts` to use the Silent Data network:

```typescript
{
  defaultNetwork: "sdr",
  networks: {
    sdr: {
      url: RPC_URL,
      accounts: [PRIVATE_KEY],
      silentdata: {},  // Enable Silent Data features
    },
  }
}
```

## Smart Contracts

The example includes a simple `PrivateToken.sol` contract that implements a privacy-focused ERC-20 token with the following features:

- Implements the ERC-20 standard interface
- Only allows token holders to view their own balance through the `balanceOf` method

These is also a very basic contract example called `SimpleContract`.

## Deployment - PrivateToken

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/PrivateToken.ts`.

To deploy the contract:

```bash
pnpm deploy:private-token
```

This will:

1. Compile the PrivateToken contract
2. Deploy it to the Silent Data network

## Deployment - PrivateEvents

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/PrivateEvents.ts`.

To deploy the contract:

```bash
pnpm deploy:private-events
```

This will:

1. Compile the PrivateEvents contract
2. Deploy it to the Silent Data network

## Deployment - SimpleContract

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/SimpleContract.ts`.

To deploy the contract:

```bash
pnpm deploy:simple-contract
```

This will:

1. Compile the SimpleContract contract
2. Deploy it to the Silent Data network

## Deployment - ERC20TestToken

The project uses Hardhat Ignition for deployments. The deployment module is configured in `ignition/modules/ERC20TestToken.ts`.

To deploy the contract to Ethereum:

```bash
pnpm deploy:erc20-test-token:ethereum
```

To deploy the contract to Sepolia:

```bash
pnpm deploy:erc20-test-token:sepolia
```

This will:

1. Compile the ERC20TestToken contract
2. Deploy it to the specified network (Ethereum or Sepolia)

## Deployment - Standard Bridge ERC-20 Token

This deployment creates an Optimism Mintable ERC-20 token on Silent Data (L2) that is bridged from an existing ERC-20 token on Ethereum or Sepolia (L1). The task uses the L2 Standard Bridge contract to automatically create a bridged version of your L1 token.

To deploy a Standard Bridge ERC-20 Token, you need to provide:

- `remoteTokenAddress`: The address of the ERC-20 token on L1 (Ethereum or Sepolia)
- `remoteTokenNetwork`: The network where the remote token exists (either `ethereum` or `sepolia`)

```bash
pnpm deploy:erc20-standard-bridge-token --remote-token-address <L1_TOKEN_ADDRESS> --remote-token-network <ethereum|sepolia>
```

For example:

```bash
pnpm deploy:erc20-standard-bridge-token --remote-token-address 0x1234567890123456789012345678901234567890 --remote-token-network sepolia
```

This will:

1. Compile the contracts
2. Connect to the specified L1 network (Ethereum or Sepolia) to fetch the token metadata (name and symbol)
3. Call `createOptimismMintableERC20` on the L2 Standard Bridge contract (0x4200000000000000000000000000000000000012)
4. Create a standard bridged ERC-20 token on Silent Data with the same name and symbol as the L1 token
5. Return the address of the newly created L2 token

## Deployment - Custom Bridge ERC-20 Token

This deployment creates a custom ERC-20 token on Silent Data (L2) that is bridged from an existing ERC-20 token on Ethereum or Sepolia (L1). Unlike the Standard Bridge deployment, this uses a custom token implementation (`MyCustomL2Token`) that you can modify to add custom logic while maintaining bridge compatibility.

To deploy a Custom Bridge ERC-20 Token, you need to provide:

- `remoteTokenAddress`: The address of the ERC-20 token on L1 (Ethereum or Sepolia)
- `remoteTokenNetwork`: The network where the remote token exists (either `ethereum` or `sepolia`)

```bash
pnpm deploy:erc20-custom-bridge-token --remote-token-address <L1_TOKEN_ADDRESS> --remote-token-network <ethereum|sepolia>
```

For example:

```bash
pnpm deploy:erc20-custom-bridge-token --remote-token-address 0x1234567890123456789012345678901234567890 --remote-token-network sepolia
```

This will:

1. Compile the contracts
2. Connect to the specified L1 network (Ethereum or Sepolia) to fetch the token metadata (name and symbol)
3. Deploy the `MyCustomL2Token` contract with the L2 Standard Bridge address and remote token address
4. Create a custom bridged ERC-20 token on Silent Data with the same name and symbol as the L1 token
5. Return the address of the newly deployed L2 token

## Development

### Available Scripts

- `pnpm compile` - Compile all contracts
- `pnpm deploy:private-token` - Deploy the PrivateToken contract using Hardhat Ignition
- `pnpm deploy:private-events` - Deploy the PrivateEvents contract using Hardhat Ignition
- `pnpm deploy:simple-contract` - Deploy the SimpleContract contract using Hardhat Ignition
- `pnpm deploy:erc20-test-token:ethereum` - Deploy the ERC20TestToken contract to Ethereum network
- `pnpm deploy:erc20-test-token:sepolia` - Deploy the ERC20TestToken contract to Sepolia network
- `pnpm deploy:erc20-standard-bridge-token --remote-token-address <ADDRESS> --remote-token-network <ethereum|sepolia>` - Create a standard bridged ERC-20 token on Silent Data from an existing L1 token
- `pnpm deploy:erc20-custom-bridge-token --remote-token-address <ADDRESS> --remote-token-network <ethereum|sepolia>` - Create a custom bridged ERC-20 token on Silent Data from an existing L1 token

### Project Dependencies

Main dependencies include:

- `@appliedblockchain/silentdatarollup-hardhat-plugin`: Enables Silent Data integration
- `@nomicfoundation/hardhat-ignition-ethers`: Provides deployment management
- `hardhat`: The core development environment

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Hardhat Documentation](https://hardhat.org/hardhat2)
- [Hardhat Ignition Guide](https://hardhat.org/ignition/docs/getting-started)
