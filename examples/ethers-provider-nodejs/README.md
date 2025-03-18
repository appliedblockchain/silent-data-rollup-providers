# Silent Data [Rollup] Node.js Example

This repository demonstrates how to interact with the Silent Data [Rollup] using Node.js and the `@appliedblockchain/silentdatarollup-ethers-provider` package. The example includes basic functionalities such as checking token balances and transferring tokens.

## Features

- Connect to the Silent Data [Rollup] network
- Retrieve token details (name, symbol, decimals)
- Transfer tokens to a randomly generated wallet
- Check token balances

## Prerequisites

- Node.js (v18 or higher)
- npm
- Access to a Silent Data [Rollup] RPC endpoint
- A private key for wallet access

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd examples/ethers-provider-nodejs
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add your environment variables:

   ```plaintext
   RPC_URL=<your_rpc_url>
   CHAIN_ID=<your_chain_id>
   PRIVATE_KEY=<your_private_key>
   TOKEN_ADDRESS=<your_token_address>
   ```

## Usage

To run the example, use the following command:

```bash
npm run contract-interaction
```

or

```bash
npm run get-balance
```
