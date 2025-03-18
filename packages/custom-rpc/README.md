# Silent Data [Rollup] Providers - Custom RPC Package

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Integration](#integration)
  - [Custom RPC Integration](#custom-rpc-integration)
    - [Installing Custom RPC Dependencies](#installing-custom-rpc-dependencies)
    - [Custom RPC Integration Example](#custom-rpc-integration-example)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Additional Resources](#additional-resources)

## Introduction

Custom RPC provider for Silent Data [Rollup], providing a local development environment with Silent Data [Rollup] integration.

## Prerequisites

- Node.js (version 18 or higher)
- npm
- Basic knowledge of Ethereum and smart contracts
- Hardhat (for local development)

## Integration

### Custom RPC Integration

#### Installing Custom RPC Dependencies

```bash
npm install @appliedblockchain/silentdatarollup-custom-rpc
```

#### Custom RPC Integration Example

The Custom RPC package provides a local development environment that integrates Silent Data [Rollup] with a local Hardhat node. To start the development environment:

```bash
npm run dev
```

This command will start both a Hardhat node and the Custom RPC server concurrently. The Custom RPC server will proxy requests to the Hardhat node while adding Silent Data [Rollup] functionality.

You can configure the Custom RPC server by creating a `.env` file in your project root:

```env
PORT=3000
HARDHAT_RPC_URL=http://localhost:8545
```

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure Hardhat is properly installed and configured
2. Verify that the port specified in your `.env` file is available
3. Check that the Hardhat node is running and accessible
4. Ensure all required environment variables are set

## License

This project is licensed under the [MIT License](LICENSE).

## Additional Resources

- [Silent Data [Rollup] Documentation](https://docs.silentdata.com)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
