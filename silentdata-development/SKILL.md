---
name: silentdata-development
description: Build privacy-preserving smart contracts and dApps on Silent Data L2. Use when creating contracts with private read methods, private events, confidential ERC-20 (UCEF), compliant security tokens (UCEF3643), or deploying to Silent Data blockchain. Handles Hardhat deployment, ethers.js/viem integration, and private event consumption.
license: MIT
metadata:
  author: appliedblockchain
  version: '1.6'
  repository: https://github.com/appliedblockchain/silent-data-rollup-providers
---

# Silent Data Development

Build privacy-preserving smart contracts and decentralized applications on Silent Data - a privacy-first Layer 2 blockchain built on Optimism.

## Overview

Silent Data is different from standard EVM chains:

1. **Private State**: The entire blockchain state is encrypted using Intel TDX hardware enclaves
2. **Authenticated RPC**: All requests go through a Custom RPC that authenticates users via signatures
3. **`msg.sender` in View Functions**: Unlike standard EVM, `msg.sender` is available in `eth_call` when signed
4. **Private Events**: Events can be selectively visible only to specified addresses

## Quick Start

### Installation

```bash
# For Hardhat deployment
npm install @appliedblockchain/silentdatarollup-hardhat-plugin

# For dApp development with ethers.js
npm install @appliedblockchain/silentdatarollup-ethers-provider ethers@6

# For dApp development with viem
npm install @appliedblockchain/silentdatarollup-viem viem
```

### Prerequisites

1. Sign up at [silentdata.com](https://www.silentdata.com/)
2. Create an App Chain or use the public testnet/mainnet
3. Get your RPC URL and generate an API token from the dashboard

## Smart Contract Patterns

### Private Read Methods

The key innovation: use `msg.sender` to restrict who can read data.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PrivateToken is ERC20 {
    error UnauthorizedBalanceQuery(address requester, address account);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    // Only the account owner can view their balance
    function balanceOf(address account) public view override returns (uint256) {
        if (account != msg.sender) {
            revert UnauthorizedBalanceQuery(msg.sender, account);
        }
        return super.balanceOf(account);
    }
}
```

**How it works**: When using the Silent Data provider, `eth_call` requests are signed, making `msg.sender` the caller's actual address. Unsigned requests via standard RPC assign a random address to `msg.sender`, preventing unauthorized access.

### Private Events

Emit events visible only to specified addresses:

```solidity
// The standard PrivateEvent wrapper
event PrivateEvent(
    address[] allowedViewers,
    bytes32 indexed eventType,
    bytes payload
);

// Define your event type hash (matches standard ERC-20 signature)
bytes32 public constant EVENT_TYPE_TRANSFER = keccak256("Transfer(address,address,uint256)");

// Emit a private event
function _emitPrivateTransfer(address from, address to, uint256 amount) internal {
    address[] memory viewers = new address[](2);
    viewers[0] = from;
    viewers[1] = to;

    emit PrivateEvent(
        viewers,
        EVENT_TYPE_TRANSFER,
        abi.encode(from, to, amount)
    );
}
```

See [references/PRIVATE-EVENTS.md](references/PRIVATE-EVENTS.md) for detailed patterns.

## Hardhat Deployment

### Configuration

```typescript
// hardhat.config.ts
import '@nomicfoundation/hardhat-ignition-ethers'
import '@appliedblockchain/silentdatarollup-hardhat-plugin'

const RPC_URL = process.env.RPC_URL
const PRIVATE_KEY = process.env.PRIVATE_KEY

if (!RPC_URL || !PRIVATE_KEY) {
  throw new Error('RPC_URL and PRIVATE_KEY must be set in environment')
}

export default {
  solidity: '0.8.22',
  defaultNetwork: 'sdr',
  networks: {
    sdr: {
      url: RPC_URL,
      accounts: [PRIVATE_KEY],
      silentdata: {}, // Enable Silent Data features
    },
  },
}
```

### Deploy with Ignition

```typescript
// ignition/modules/PrivateToken.ts
import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('PrivateToken', (m) => {
  const name = m.getParameter('name', 'PrivateToken')
  const symbol = m.getParameter('symbol', 'PTK')
  const initialSupply = m.getParameter('initialSupply', 1000000n * 10n ** 18n)
  const token = m.contract('PrivateToken', [name, symbol, initialSupply])
  return { token }
})
```

```bash
npx hardhat ignition deploy ignition/modules/PrivateToken.ts --network sdr
```

## dApp Development

### ethers.js Provider

```typescript
import {
  SilentDataRollupProvider,
  SilentDataRollupContract,
} from '@appliedblockchain/silentdatarollup-ethers-provider'

// Initialize provider
const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  privateKey: 'YOUR_PRIVATE_KEY',
})

// For contracts with private read methods
const contract = new SilentDataRollupContract({
  address: '0x...',
  abi: contractAbi,
  runner: provider,
  contractMethodsToSign: ['balanceOf'], // Methods that need signing
})

// Now balanceOf will work - msg.sender is available
const balance = await contract.balanceOf(myAddress)
```

### viem Transport

```typescript
import { createPublicClient, createWalletClient, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sdTransport } from '@appliedblockchain/silentdatarollup-viem'

const account = privateKeyToAccount('0x...')

const sdChain = defineChain({
  id: 381185, // Testnet chain ID
  name: 'Silent Data Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['YOUR_RPC_URL'] } },
})

const transport = sdTransport({
  rpcUrl: 'YOUR_RPC_URL',
  chainId: 381185,
  privateKey: '0x...',
})

const publicClient = createPublicClient({ chain: sdChain, transport })
const walletClient = createWalletClient({ chain: sdChain, transport, account })
```

See [references/DAPP.md](references/DAPP.md) for complete guide.

## Private Events Consumption

### Get Private Logs

```typescript
import {
  SilentDataRollupProvider,
  SDInterface,
} from '@appliedblockchain/silentdatarollup-ethers-provider'

const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  privateKey: 'YOUR_PRIVATE_KEY',
})

// Get only private events you're allowed to see
const privateLogs = await provider.getPrivateLogs({
  address: contractAddress,
  fromBlock: 0,
  toBlock: 'latest',
  eventSignature: 'Transfer(address,address,uint256)', // Optional filter
})

// Decode the private events
const sdInterface = new SDInterface([
  ...contractAbi,
  'event Transfer(address from, address to, uint256 value)',
])

for (const log of privateLogs) {
  const parsed = sdInterface.parseLog(log)
  if (parsed?.innerLog) {
    const { from, to, value } = parsed.innerLog.args
    console.log(`Private transfer: ${from} → ${to}: ${value}`)
  }
}
```

## Network Configuration

| Network | Chain ID | RPC URL            |
| ------- | -------- | ------------------ |
| Mainnet | 380929   | Get from dashboard |
| Testnet | 381185   | Get from dashboard |

## UCEF - Confidential ERC-20 Framework

For production-ready confidential tokens, use **UCEF** (Unopinionated Confidential ERC-20 Framework):

```solidity
import "../extensions/UCEFOwned.sol";

contract MyConfidentialToken is UCEFOwned {
    constructor() UCEF("MyToken", "MTK") {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
```

**UCEF Extensions:**

| Extension       | Use Case                           |
| --------------- | ---------------------------------- |
| `UCEFOwned`     | Only owner sees their balance      |
| `UCEFRegulated` | Owner + regulator can see balances |
| `UCEFSharable`  | Owner can grant viewing to others  |
| `UCEFPermit`    | EIP-2612 gasless approvals         |
| `UCEFVotes`     | Governance with private balances   |

See [references/UCEF.md](references/UCEF.md) for complete documentation.

## UCEF3643 - Compliant Security Tokens

For **regulated security tokens** that need both privacy and compliance, use **UCEF3643**:

```solidity
import "./UCEF3643.sol";

// UCEF3643 combines:
// - UCEF privacy (confidential balances, private events)
// - ERC-3643 compliance (identity verification, transfer restrictions)
contract MySecurityToken is UCEF3643 {
    // Inherits all privacy + compliance features
}
```

**Key Features:**

| Feature               | Description                                |
| --------------------- | ------------------------------------------ |
| Confidential Balances | Only owner/identity can view balances      |
| Private Events        | Transfer, Approval, Freeze events private  |
| Identity Registry     | ERC-3643 identity verification             |
| Compliance Module     | Modular compliance rules on transfers      |
| Auditor Role          | Designated auditors see all private events |
| Token Freezing        | Freeze tokens for regulatory actions       |

**Auditor Management:**

```solidity
// Add/remove auditors (agents only)
function addAuditor(address account) external onlyAgent
function removeAuditor(address account) external onlyAgent
function setAuditors(address[] calldata newAuditors) external onlyAgent
```

See [references/UCEF3643.md](references/UCEF3643.md) for complete documentation.

## Common Tasks

### Create a Private ERC-20 Token

Use the template at [assets/templates/PrivateToken.sol](assets/templates/PrivateToken.sol)

### Create a Contract with Private Events

Use the template at [assets/templates/PrivateEvents.sol](assets/templates/PrivateEvents.sol)

### Owner-Only Private Reads

```solidity
modifier onlyOwnerCanRead() {
    require(msg.sender == owner(), "Not authorized to read");
    _;
}

function getSecretData() public view onlyOwnerCanRead returns (bytes memory) {
    return _secretData;
}
```

### Multi-Party Private Events

```solidity
function _emitToParties(address[] memory parties, bytes memory data) internal {
    emit PrivateEvent(
        parties,
        EVENT_TYPE_NOTIFICATION,
        data
    );
}
```

## Safety & Guardrails

### Before Deploying

- **Always test on testnet first** before mainnet deployment
- **Ask for confirmation** before deploying to production networks
- **Verify contract addresses** before interacting with deployed contracts

### Secrets Management

⚠️ **Never hardcode or paste private keys/API tokens in code**

```bash
# .env (add to .gitignore!)
PRIVATE_KEY=0x...your_64_hex_chars...
RPC_URL=https://...
```

```typescript
// Load from environment
const privateKey = process.env.PRIVATE_KEY
if (!privateKey?.startsWith('0x')) {
  throw new Error('PRIVATE_KEY must be set with 0x prefix')
}
```

Ensure `.gitignore` includes:

```
.env
.env.local
*.key
```

### Destructive Operations

Ask before running:

- Mainnet deployments
- Token minting/burning
- Ownership transfers
- Contract upgrades

## Resources

- [Documentation](https://docs.silentdata.com)
- [GitHub Repository](https://github.com/appliedblockchain/silent-data-rollup-providers)
- [Examples](https://github.com/appliedblockchain/silent-data-rollup-providers/tree/main/examples)

## Detailed References

- [Contract Patterns](references/CONTRACTS.md) - In-depth smart contract patterns
- [Private Events Guide](references/PRIVATE-EVENTS.md) - Complete private events documentation
- [dApp Development](references/DAPP.md) - Full dApp development guide
- [UCEF Framework](references/UCEF.md) - Confidential ERC-20 framework
- [UCEF3643](references/UCEF3643.md) - Compliant security tokens (ERC-3643 + UCEF)
