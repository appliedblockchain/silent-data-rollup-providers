# Smart Contract Patterns for Silent Data

Deep dive into privacy-preserving smart contract patterns.

## Core Concept: `msg.sender` in View Functions

On Silent Data, the Custom RPC signs `eth_call` requests, making `msg.sender` the caller's actual address. Unsigned requests via standard RPC receive a random `msg.sender`, preventing unauthorized access.

This enables **access control on read operations**.

## Pattern 1: Private Balance (ERC-20)

Only token holders can see their own balance.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PrivateBalanceToken is ERC20 {
    error UnauthorizedBalanceQuery(address requester, address account);

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function balanceOf(address account) public view override returns (uint256) {
        // Only the account owner can query their balance
        if (account != msg.sender) {
            revert UnauthorizedBalanceQuery(msg.sender, account);
        }
        return super.balanceOf(account);
    }

    // totalSupply remains public - aggregate data is OK
    // transfer/approve work normally - they're write operations
}
```

## Pattern 2: Owner-Only Private Data

Contract owner can read sensitive data, others cannot.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PrivateVault is Ownable {
    mapping(bytes32 => bytes) private _secrets;

    error NotAuthorized();

    constructor() Ownable(msg.sender) {}

    function storeSecret(bytes32 key, bytes calldata value) external onlyOwner {
        _secrets[key] = value;
    }

    function getSecret(bytes32 key) external view returns (bytes memory) {
        if (msg.sender != owner()) {
            revert NotAuthorized();
        }
        return _secrets[key];
    }
}
```

## Pattern 3: Role-Based Private Access

Different roles can access different data.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract RoleBasedPrivacy is AccessControl {
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct FinancialRecord {
        uint256 revenue;
        uint256 expenses;
        string notes;
    }

    mapping(uint256 => FinancialRecord) private _records;

    error InsufficientRole();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Auditors can see everything
    function getFullRecord(uint256 id) external view returns (FinancialRecord memory) {
        if (!hasRole(AUDITOR_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert InsufficientRole();
        }
        return _records[id];
    }

    // Managers can only see summary
    function getRecordSummary(uint256 id) external view returns (uint256 netIncome) {
        if (!hasRole(MANAGER_ROLE, msg.sender) &&
            !hasRole(AUDITOR_ROLE, msg.sender) &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert InsufficientRole();
        }
        FinancialRecord storage record = _records[id];
        return record.revenue - record.expenses;
    }
}
```

## Pattern 4: Private NFT Ownership (ERC-721)

Only the owner can see they own a specific NFT.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract PrivateNFT is ERC721 {
    error UnauthorizedOwnerQuery();

    constructor() ERC721("PrivateNFT", "PNFT") {}

    function ownerOf(uint256 tokenId) public view override returns (address) {
        address owner = super.ownerOf(tokenId);
        // Only the actual owner can query ownership
        if (msg.sender != owner) {
            revert UnauthorizedOwnerQuery();
        }
        return owner;
    }

    // balanceOf could also be restricted
    function balanceOf(address owner) public view override returns (uint256) {
        if (msg.sender != owner) {
            revert UnauthorizedOwnerQuery();
        }
        return super.balanceOf(owner);
    }
}
```

## Pattern 5: Counterparty Privacy

Both parties in a transaction can see details, no one else can.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract PrivateEscrow {
    struct Deal {
        address buyer;
        address seller;
        uint256 amount;
        bytes32 secretHash;
        bool completed;
    }

    mapping(uint256 => Deal) private _deals;
    uint256 private _dealCounter;

    error NotPartyToDeal();

    function createDeal(address seller, bytes32 secretHash) external payable returns (uint256) {
        uint256 dealId = _dealCounter++;
        _deals[dealId] = Deal({
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            secretHash: secretHash,
            completed: false
        });
        return dealId;
    }

    function getDeal(uint256 dealId) external view returns (Deal memory) {
        Deal storage deal = _deals[dealId];
        // Only buyer or seller can view deal details
        if (msg.sender != deal.buyer && msg.sender != deal.seller) {
            revert NotPartyToDeal();
        }
        return deal;
    }
}
```

## Best Practices

### 1. Always Check `msg.sender`

```solidity
// Good - explicit check
function getPrivateData() external view returns (bytes memory) {
    require(msg.sender == authorizedAddress, "Not authorized");
    return _data;
}

// Bad - no access control
function getPrivateData() external view returns (bytes memory) {
    return _data; // Anyone can read!
}
```

### 2. Use Custom Errors for Gas Efficiency

```solidity
// Good
error UnauthorizedAccess(address caller);

function getData() external view returns (uint256) {
    if (msg.sender != owner) revert UnauthorizedAccess(msg.sender);
    return _data;
}

// Less efficient
function getData() external view returns (uint256) {
    require(msg.sender == owner, "Not authorized");
    return _data;
}
```

### 3. Consider What Should Be Public

Not everything needs to be private. Consider:

- `totalSupply()` - Usually OK to be public
- `name()`, `symbol()` - Should be public
- Individual balances - Often should be private
- Transaction history - Often should be private

### 4. Test with Standard Provider First

Your contract should work with standard providers too (just with restricted access):

```typescript
import {
  SilentDataRollupProvider,
  SilentDataRollupContract,
} from '@appliedblockchain/silentdatarollup-ethers-provider'

// Setup provider
const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  privateKey: '0x...',
})

// Instantiate contract with methods that need signing
const privateToken = new SilentDataRollupContract({
  address: '0x1234...',
  abi: [
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address, uint256) returns (bool)',
  ],
  runner: provider.signer,
  contractMethodsToSign: ['balanceOf'], // These methods will be signed
})

// With Silent Data provider - works (balanceOf is signed, msg.sender available)
const balance = await privateToken.balanceOf(myAddress)

// With standard provider - should revert cleanly
try {
  await standardProvider.balanceOf(myAddress)
} catch (e) {
  // Expected: UnauthorizedBalanceQuery
}
```

## Common Mistakes

### Mistake 1: Forgetting View Functions Are Also Signed

```solidity
// This WON'T hide data - write functions don't use msg.sender for access control
function transfer(address to, uint256 amount) public {
    // msg.sender is always correct in write functions
    // The data is in the transaction, visible on-chain
}
```

### Mistake 2: Relying on Privacy for Security

```solidity
// BAD - Security through obscurity
function withdraw(bytes32 secret) external {
    require(keccak256(abi.encodePacked(secret)) == _secretHash);
    // Even if reading is private, brute force is possible
}
```

### Mistake 3: Assuming msg.sender Is Predictable Without Signing

```solidity
// This is actually safe on Silent Data!
function balanceOf(address account) public view returns (uint256) {
    if (account != msg.sender) revert Unauthorized();
    return super.balanceOf(account);
}
// Unsigned requests get a random msg.sender, so unauthorized
// callers can't predict or match any specific account.
```
