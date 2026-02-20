# Silent Data Custom RCP Example

For development purposes, this repository exposes a Silent Data Custom RPC using hardhat.

## Prerequisites

- Node.js (v18 or higher)
- pnpm

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
   cd examples/custom-rpc
   pnpm install
   ```

5. Create a `.env` file by copying the provided `.env.example` file and updating your environment variables:

   ```plaintext
   CHAIN_ID=<hardhat_chain_id>
   PRIVATE_KEY=<your_private_key>
   RPC_URL=<hardhat_rpc_url>
   TOKEN_ADDRESS=<custom_rpc_port>
   ```

## Usage

Run start:

```bash
pnpm start
```

Run the example:

```bash
pnpm contract-interaction
```
