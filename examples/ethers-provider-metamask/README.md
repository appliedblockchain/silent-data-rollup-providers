# Silent Data MetaMask Example

This repository demonstrates how to interact with the Silent Data using MetaMask and both `@appliedblockchain/silentdatarollup-core` and `@appliedblockchain/silentdatarollup-ethers-provider` packages.

## Features

- Connect to the Silent Data network
- Check wallet balances
- Add and remove tokens
- Transfer tokens to a randomly generated wallet

## Prerequisites

- Node.js (v18 or higher)
- pnpm
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
   cd examples/ethers-provider-metamask
   pnpm install
   ```

5. Create a `.env` file by copying the provided `.env.example` file and updating your environment variables:

   ```plaintext
   VITE_CHAIN_ID=<your_chain_id>
   VITE_ROLLUP_RPC_URL=<your_rpc_url>
   ```

## Usage

To run the example, use the following command:

```bash
pnpm dev
```
