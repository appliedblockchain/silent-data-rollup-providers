# Silent Data Viem Fireblocks Node.js Example

This repository demonstrates how to interact with Silent Data using Node.js with Fireblocks integration using the `@appliedblockchain/silentdatarollup-viem-fireblocks` package.

## Features

- Connect to the Silent Data network using Fireblocks
- Retrieve token details (name, symbol, decimals)
- Transfer tokens to a randomly generated wallet
- Check wallet balances
- Transfer wallet balances

## Prerequisites

- Node.js (v18 or higher)
- pnpm
- Access to a Silent Data RPC endpoint
- Fireblocks account with API access

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd examples/viem-fireblocks-nodejs
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env` file in the root directory by copying the provided `.env-example` file and updating your environment variables:

   ```plaintext
   CHAIN_ID=<your_chain_id>
   FIREBLOCKS_API_KEY=<your_fireblocks_api_key>
   FIREBLOCKS_PRIVATE_KEY_PATH=<path_to_your_fireblocks_private_key>
   FIREBLOCKS_VAULT_ACCOUNT_ID=<your_vault_account_id>
   RPC_URL=<your_rpc_url>
   TOKEN_ADDRESS=<your_erc20_token_address>
   TRANSFER_VALUE_ETH=<amount_to_transfer>
   TRANSFER_WALLET_ADDRESS=<destination_wallet_address>
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
pnpm transfer-balance
```
