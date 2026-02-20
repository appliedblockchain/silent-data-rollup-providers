![Silent Data By Applied Blockchain Logo](https://cdn.prod.website-files.com/66e010db8f2318d36725b915/6703b717b513df4231a5ee72_sd-logo-landscape.svg)

# Silent Data Providers

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Introduction

This monorepo contains multiple packages for custom providers for Silent Data, compatible with ethers.js and Hardhat plugins.

## Features

These packages offer several key features:

1. **RPC Call Interception**: Automatically intercepts RPC calls and appends necessary authentication headers, simplifying the integration process.

2. **Ethers.js Compatibility**: Seamlessly integrates with ethers.js, allowing developers to use familiar tools and patterns.

3. **Multiple Provider Types**: Supports various provider types, including basic usage, contract interaction, Fireblocks integration, and Hardhat compatibility.

4. **Flexible Authentication**: Transparently handles authentication, supporting both private key and Fireblocks-based methods.

5. **Simplified Contract Interactions**: Provides a `SilentDataRollupContract` class that streamlines interactions with smart contracts, automatically handling method signing when necessary.

6. **Network Abstraction**: Offers a `NetworkName` enum to easily switch between different Silent Data networks (e.g., testnet, mainnet).

7. **Customizable Configuration**: Allows developers to configure providers with custom RPC URLs, network settings, and authentication details.

These features make it easier for developers to integrate Silent Data into their Ethereum-based applications, handling the complexities of authentication and network interactions behind the scenes.

## Prerequisites

- Node.js (version 18 or higher)
- pnpm
- Basic knowledge of Ethereum and smart contracts

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

3. Build all packages:

   ```bash
   pnpm build
   ```

## Packages and Integration Options

- [Core](./packages/core/README.md)
- [Custom RPC](./packages/custom-rpc/README.md)
- [Ethers Provider](./packages/ethers-provider/README.md)
- [Fireblocks Ethers Provider](./packages/ethers-provider-fireblocks/README.md)
- [Hardhat Plugin](./packages/hardhat-plugin/README.md)
- [Fireblocks Hardhat Plugin](./packages/hardhat-plugin-fireblocks/README.md)
- [Viem](./packages/viem/README.md)
- [Fireblocks Viem](./packages/viem-fireblocks/README.md)

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure you're using the correct RPC URL for your desired network.
2. Verify that your private key is correctly set and has sufficient funds.
3. Ensure that your token is still active on the Silent Data AppChains dashboard.
4. If using Fireblocks, validate your user and API keys.

## License

This project is licensed under the [MIT License](LICENSE).
