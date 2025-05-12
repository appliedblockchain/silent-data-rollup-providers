# Silent Data [Rollup] Custom RCP Example

For development purposes, this repository exposes a Silent Data [Rollup] Custom RPC using hardhat.

## Prerequisites

- Node.js (v18 or higher)
- npm

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd examples/custom-rpc
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory by copying the provided `.env.example` file and updating your environment variables:

   ```plaintext
   CHAIN_ID=<hardhat_chain_id>
   PRIVATE_KEY=<your_private_key>
   RPC_URL=<hardhat_rpc_url>
   TOKEN_ADDRESS=<custom_rpc_port>
   ```

## Usage

Run start:

```bash
npm run start
```

Run the example:

```bash
npm run contract-interaction
```
