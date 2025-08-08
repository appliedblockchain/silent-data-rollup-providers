# Silent Data [Rollup] MetaMask Example

This repository demonstrates how to interact with the Silent Data [Rollup] using MetaMask and both `@appliedblockchain/silentdatarollup-core` and `@appliedblockchain/silentdatarollup-ethers-provider` packages.

## Features

- Connect to the Silent Data [Rollup] network
- Check wallet balances
- Add and remove tokens
- Transfer tokens to a randomly generated wallet

## Prerequisites

- Node.js (v18 or higher)
- npm
- Access to a Silent Data [Rollup] RPC endpoint

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd examples/ethers-provider-metamask
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory by copying the provided `.env.example` file and updating your environment variables:

   ```plaintext
   VITE_CHAIN_ID=<your_chain_id>
   VITE_ROLLUP_RPC_URL=<your_rpc_url>
   ```

## Usage

To run the example, use the following command:

```bash
npm run dev
```
