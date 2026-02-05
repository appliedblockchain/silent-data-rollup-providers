# Silent Data Node.js Example

This repository demonstrates how to interact with the Silent Data using Node.js and both `@appliedblockchain/silentdatarollup-core` and `@appliedblockchain/silentdatarollup-ethers-provider` packages.

## Features

- Connect to the Silent Data network
- Retrieve token details (name, symbol, decimals)
- Transfer tokens to a randomly generated wallet
- Check wallet balances
- Transfer wallet balances

## Prerequisites

- Node.js (v18 or higher)
- pnpm
- Access to a Silent Data RPC endpoint

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd examples/ethers-provider-nodejs
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env` file in the root directory by copying the provided `.env.example` file and updating your environment variables:

   ```plaintext
   CHAIN_ID=<your_chain_id>
   PRIVATE_KEY=<your_private_key>
   RPC_URL=<your_rpc_url>
   TOKEN_ADDRESS=<your_token_address>
   TRANSFER_VALUE_ETH=<transfer_to_value>
   TRANSFER_WALLET_ADDRESS=<transfer_to_private_key>
   ```

## Usage

To run the example, use the following command:

```bash
pnpm contract-interaction
```

or

```bash
pnpm get-balance
```

or

```bash
pnpm get-transactions-by-address
```

or

```bash
pnpm transfer-balance
```
