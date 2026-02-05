# UCEF - Unopinionated Confidential ERC-20 Framework

A framework for building confidential ERC-20 tokens with the standard interface, no custom libraries, and cryptography-agnostic design.

## Overview

UCEF solves the tension between transparency and privacy in DeFi. Standard ERC-20 tokens expose all balances and transaction amounts. UCEF provides confidentiality while maintaining full ERC-20 compatibility.

**Key Features:**

- Same ERC-20 interface - no breaking changes
- No custom libraries - pure Solidity
- Cryptography agnostic - works with TEE, FHE, MPC, or ZK
- Programmable confidentiality - customize who can see what

## How It Works

UCEF uses Solidity authorization checks to control balance visibility:

```solidity
function balanceOf(address account) public view override returns (uint256) {
    bool authorized = _authorizeBalance(account);
    return authorized ? _balanceOf(account) : 0;
}
```

On Silent Data, `msg.sender` is available in view functions (via signed `eth_call`), enabling access control on reads.

## Base Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract UCEF is ERC20 {
    error UCEFUnauthorizedBalanceAccess(address sender, address account);

    // Override this to define who can view balances
    function _authorizeBalance(address account) internal view virtual returns (bool);

    function balanceOf(address account) public view override virtual returns (uint256) {
        bool authorized = _authorizeBalance(account);
        return authorized ? _balanceOf(account) : 0;
    }

    // ... rest of implementation
}
```

## Extensions

UCEF provides ready-to-use extensions:

### UCEFOwned - Owner-Only Access

Only the account owner can view their balance.

```solidity
import "../extensions/UCEFOwned.sol";

contract MyPrivateToken is UCEFOwned {
    constructor() UCEF("MyToken", "MTK") {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
```

### UCEFRegulated - Owner + Regulator Access

A designated regulator can view all balances for compliance.

```solidity
import "../extensions/UCEFRegulated.sol";

contract RegulatedToken is UCEFRegulated {
    constructor(address regulator)
        UCEF("RegulatedToken", "RTK")
        UCEFRegulated(regulator)
    {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
```

The regulator can:

- View any account's balance
- Transfer regulator role to another address

### UCEFSharable - Selective Sharing

Account owners can grant viewing permission to specific addresses.

```solidity
import "../extensions/UCEFSharable.sol";

contract SharableToken is UCEFSharable {
    constructor(address supervisor)
        UCEF("SharableToken", "STK")
        UCEFSharable(supervisor)
    {}
}
```

Users can:

- `grantViewer(address)` - Allow someone to see their balance
- `revokeViewer(address)` - Remove viewing permission
- `hasViewPermission(account, viewer)` - Check permissions

### Other Extensions

| Extension       | Purpose                        |
| --------------- | ------------------------------ |
| `UCEFBurnable`  | Token burning functionality    |
| `UCEFCapped`    | Maximum supply cap             |
| `UCEFPausable`  | Pausable transfers             |
| `UCEFPermit`    | EIP-2612 gasless approvals     |
| `UCEFVotes`     | Governance voting power        |
| `UCEFWrapper`   | Wrap existing tokens           |
| `UCEFFlashMint` | Flash loan minting             |
| `ERC1363`       | Receiver callbacks on transfer |
| `ERC4626`       | Tokenized vault standard       |

## Custom Authorization

Create your own authorization logic:

```solidity
import "../token/UCEF.sol";

contract CustomPrivacyToken is UCEF {
    mapping(address => bool) public whitelisted;
    address public admin;

    constructor() UCEF("CustomToken", "CTK") {
        admin = msg.sender;
    }

    function _authorizeBalance(address account) internal view override returns (bool) {
        // Admin can see all balances
        if (msg.sender == admin) return true;

        // Whitelisted addresses can see all balances
        if (whitelisted[msg.sender]) return true;

        // Account owners can see their own balance
        if (msg.sender == account) return true;

        // Everyone else is denied
        revert UCEFUnauthorizedBalanceAccess(msg.sender, account);
    }

    function setWhitelisted(address addr, bool status) external {
        require(msg.sender == admin, "Not admin");
        whitelisted[addr] = status;
    }
}
```

## Event Privacy

UCEF also hides Transfer and Approval event parameters:

```solidity
// Standard ERC-20 emits:
emit Transfer(from, to, amount);

// UCEF emits (hiding sensitive data):
emit Transfer(address(0), address(0), 0);
```

This prevents balance/transaction tracking via event logs.

## Comparison with Other Solutions

|                                  | **UCEF** | **fhEVM ERC-20** | **FHE Framework** | **Private ERC-20** |
| -------------------------------- | -------- | ---------------- | ----------------- | ------------------ |
| **Confidential Balances**        | ✅       | ✅               | ✅                | ✅                 |
| **Fully Anonymous Accounts**     | ✅       | ❌               | ❌                | ❌                 |
| **Programmable Confidentiality** | ✅       | 🟠 Partial       | 🟠 Partial        | ❌                 |
| **Unmodified ERC-20 Interface**  | ✅       | ❌               | ❌                | ❌                 |
| **Cryptography Agnostic**        | ✅       | ❌               | ❌                | ❌                 |

## Installation

```bash
# Clone the UCEF repository
git clone https://github.com/appliedblockchain/confidential-erc-20.git

# Or copy the contracts to your project
cp -r confidential-erc-20/contracts/token ./contracts/
cp -r confidential-erc-20/contracts/extensions ./contracts/
```

## Deployment Example

```typescript
// ignition/modules/MyToken.ts
import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('MyToken', (m) => {
  const token = m.contract('UCEFOnlyOwner', [])
  return { token }
})
```

```bash
npx hardhat ignition deploy ignition/modules/MyToken.ts --network sdr
```

## Resources

- [UCEF Repository](https://github.com/appliedblockchain/confidential-erc-20)
- [Examples](https://github.com/appliedblockchain/confidential-erc-20/tree/main/contracts/examples)
- [Extensions](https://github.com/appliedblockchain/confidential-erc-20/tree/main/contracts/extensions)
