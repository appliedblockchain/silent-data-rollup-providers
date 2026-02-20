# Silent Data Smart Account Example

This repository demonstrates how to interact with the Silent Data using smart accounts (EIP-1271) with both `@appliedblockchain/silentdatarollup-core` and `@appliedblockchain/silentdatarollup-ethers-provider` packages.

## Features

- Connect to the Silent Data network with smart account support
- Check wallet balances using EIP-1271 signed read calls
- Add and remove private tokens
- Transfer tokens to randomly generated wallets

## Prerequisites

- Node.js (v18 or higher)
- npm
- Access to a Silent Data RPC endpoint

## Installation

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
   cd examples/ethers-provider-smart-account
   pnpm install
   ```

5. Create a `.env` file by copying the provided `.env.example` file and updating your environment variables:

   ```plaintext
   VITE_CHAIN_ID=
   VITE_ROLLUP_RPC_URL=
   VITE_PRIVATE_TOKEN_ADDRESS=
   VITE_SMART_ACCOUNT_ADDRESS=
   ```

## Usage

To run the example, use the following command:

```bash
pnpm dev
```
