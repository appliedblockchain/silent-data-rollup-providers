# Silent Data Providers - Custom RPC Package

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

Custom RPC is the Silent Data privacy-enforcement RPC gateway (firewall). It sits
between clients and an EVM node and:

- enforces a strict **method + parameter whitelist** (everything else is rejected);
- recovers the request **signer** (EIP-191, EIP-712, ephemeral-key delegation, and
  ERC-1271 smart-wallet signatures) and applies signer-based access control;
- **redacts** sensitive fields from `eth_getTransactionByHash` /
  `eth_getTransactionReceipt` responses for unauthorized callers;
- **filters private-event logs** (`eth_getLogs` / `eth_getFilterLogs` /
  `eth_getFilterChanges`) so only `allowedViewers` see them;
- **limits the `eth_getLogs` block range**;
- restricts `eth_getBlockBy*` to header-only (no full transaction objects);
- handles the custom `sd_getVersion` and `sd_getTransactionsByAddress` methods.

It can be used both as a local development environment (in front of a Hardhat node)
and as a standalone gateway in front of any EVM node.

## Prerequisites

- Node.js (version 20 or higher)
- pnpm
- Basic knowledge of Ethereum and smart contracts
- Hardhat (for local development)

## Integration

### Custom RPC Integration

#### Installing Custom RPC Dependencies

```bash
pnpm add @appliedblockchain/silentdatarollup-custom-rpc
```

#### Custom RPC Integration Example

The Custom RPC package provides a local development environment that integrates Silent Data with a local Hardhat node. To start the development environment:

```bash
pnpm dev
```

This command will start both a Hardhat node and the Custom RPC server concurrently. The Custom RPC server will proxy requests to the Hardhat node while adding Silent Data functionality.

#### Running the server standalone

Installing the package also provides a `silentdatarollup-custom-rpc` binary that
starts the gateway:

```bash
silentdatarollup-custom-rpc
# or, within a workspace:  pnpm exec silentdatarollup-custom-rpc
```

By default it listens on port `54321` and proxies to `http://localhost:8545`.

#### Configuration

Configure the server with environment variables (a `.env` file in the working
directory is loaded automatically):

| Variable                            | Default                 | Description                                                                                                                          |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `CUSTOM_RPC_PORT`                   | `54321`                 | Port the gateway listens on.                                                                                                         |
| `CUSTOM_RPC_PROXY_URL`              | `http://localhost:8545` | URL of the backing EVM node requests are proxied to.                                                                                 |
| `CUSTOM_RPC_LOGS_LIMIT_RANGE`       | `10000`                 | Maximum block range allowed for a single `eth_getLogs`.                                                                              |
| `CUSTOM_RPC_PER_PAGE`               | `10`                    | Default page size for `sd_getTransactionsByAddress`.                                                                                 |
| `CUSTOM_RPC_BYPASS_METHOD_PREFIXES` | (unset)                 | Comma-separated method-name prefixes that bypass the whitelist (e.g. `hardhat,anvil`). **Dev/test only — do not set in production.** |

```env
CUSTOM_RPC_PORT=54321
CUSTOM_RPC_PROXY_URL=http://localhost:8545
```

> Note: contract **deployment tooling** (Hardhat / Ignition) calls dev-only RPC
> methods (e.g. `hardhat_metadata`, `hardhat_getAutomine`) that are not whitelisted.
> To deploy through the gateway against a local node, set
> `CUSTOM_RPC_BYPASS_METHOD_PREFIXES=hardhat` (dev/test only).

## Troubleshooting

If you encounter any issues, please check the following:

1. Ensure Hardhat is properly installed and configured
2. Verify that `CUSTOM_RPC_PORT` is available
3. Check that the backing node at `CUSTOM_RPC_PROXY_URL` is running and accessible
4. Ensure all required environment variables are set

## License

This project is licensed under the [MIT License](LICENSE).

## Additional Resources

- [Silent Data Documentation](https://docs.silentdata.com)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
