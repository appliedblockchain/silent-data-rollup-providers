# Private Events Guide

Complete guide to implementing and consuming private events on Silent Data.

## Overview

Private Events enable selective visibility of on-chain events. Only addresses listed in `allowedViewers` can retrieve the event data through the Custom RPC.

## The PrivateEvent Format

All private events use a standard wrapper:

```solidity
event PrivateEvent(
    address[] allowedViewers,  // Who can see this event
    bytes32 indexed eventType, // keccak256 of the original event signature
    bytes payload              // ABI-encoded event data
);
```

- **allowedViewers**: Array of addresses authorized to view the event
- **eventType**: The keccak256 hash of your logical event signature (indexed for filtering)
- **payload**: The actual event data, ABI-encoded

## Emitting Private Events

### Basic Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract PrivateEventEmitter {
    // The wrapper event
    event PrivateEvent(
        address[] allowedViewers,
        bytes32 indexed eventType,
        bytes payload
    );

    // Define your event type hash
    bytes32 public constant EVENT_TYPE_MESSAGE = keccak256("PrivateMessage(address,string)");

    function sendPrivateMessage(address recipient, string calldata message) external {
        // Define who can see this event
        address[] memory viewers = new address[](2);
        viewers[0] = msg.sender;    // Sender can see
        viewers[1] = recipient;      // Recipient can see

        // Emit the private event
        emit PrivateEvent(
            viewers,
            EVENT_TYPE_MESSAGE,
            abi.encode(msg.sender, message)
        );
    }
}
```

### Private Transfer Event

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PrivateTransferToken is ERC20 {
    event PrivateEvent(
        address[] allowedViewers,
        bytes32 indexed eventType,
        bytes payload
    );

    // Matches standard Transfer event signature
    bytes32 public constant EVENT_TYPE_TRANSFER =
        keccak256("Transfer(address,address,uint256)");

    constructor() ERC20("PrivateTransfer", "PTXN") {
        _mint(msg.sender, 1000000 * 10**18);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        bool success = super.transfer(to, amount);

        if (success) {
            _emitPrivateTransfer(msg.sender, to, amount);
        }

        return success;
    }

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
}
```

### Multi-Party Events

For events visible to multiple parties:

```solidity
function _emitToGroup(address[] memory members, bytes memory data) internal {
    emit PrivateEvent(
        members,
        EVENT_TYPE_GROUP_UPDATE,
        data
    );
}

// Usage
address[] memory boardMembers = getBoard();
_emitToGroup(boardMembers, abi.encode(proposalId, "approved"));
```

### Admin-Only Events

For events only admins should see:

```solidity
function _emitAdminEvent(bytes memory data) internal {
    address[] memory admins = new address[](1);
    admins[0] = owner();

    emit PrivateEvent(
        admins,
        EVENT_TYPE_ADMIN_ACTION,
        data
    );
}
```

## Consuming Private Events

### Using SilentDataRollupProvider

```typescript
import { SilentDataRollupProvider } from '@appliedblockchain/silentdatarollup-ethers-provider'

const provider = new SilentDataRollupProvider({
  rpcUrl: 'YOUR_RPC_URL',
  privateKey: 'YOUR_PRIVATE_KEY',
})

// Get all logs (public + private you're allowed to see)
const allLogs = await provider.getAllLogs({
  address: contractAddress,
  fromBlock: 0,
  toBlock: 'latest',
})

// Get only private events you're allowed to see
const privateLogs = await provider.getPrivateLogs({
  address: contractAddress,
  fromBlock: 0,
  toBlock: 'latest',
})

// Filter by specific event type
const transferLogs = await provider.getPrivateLogs({
  address: contractAddress,
  fromBlock: 0,
  toBlock: 'latest',
  eventSignature: 'Transfer(address,address,uint256)',
})
```

### Decoding Private Events with SDInterface

```typescript
import { SDInterface } from '@appliedblockchain/silentdatarollup-ethers-provider'

// Create interface with your ABI + the inner event signatures
const sdInterface = new SDInterface([
  // Your contract ABI (including PrivateEvent)
  ...contractAbi,
  // Add the inner event signatures for decoding
  'event Transfer(address from, address to, uint256 value)',
  'event PrivateMessage(address sender, string message)',
])

// Parse a private log
const privateLogs = await provider.getPrivateLogs({ address: contractAddress })

for (const log of privateLogs) {
  const parsed = sdInterface.parseLog(log)

  if (parsed) {
    console.log('Outer event:', parsed.name) // 'PrivateEvent'
    console.log('Allowed viewers:', parsed.args.allowedViewers)

    // Access the decoded inner event
    if (parsed.innerLog) {
      console.log('Inner event:', parsed.innerLog.name) // e.g., 'Transfer'
      console.log('Inner args:', parsed.innerLog.args)

      // Type-safe access to args
      const { from, to, value } = parsed.innerLog.args
    }
  }
}
```

### Complete Example: Listening to Private Transfers

```typescript
import {
  SilentDataRollupProvider,
  SDInterface,
} from '@appliedblockchain/silentdatarollup-ethers-provider'

async function monitorPrivateTransfers(contractAddress: string) {
  const provider = new SilentDataRollupProvider({
    rpcUrl: process.env.RPC_URL!,
    privateKey: process.env.PRIVATE_KEY!,
  })

  const sdInterface = new SDInterface([
    'event PrivateEvent(address[] allowedViewers, bytes32 indexed eventType, bytes payload)',
    'event Transfer(address from, address to, uint256 value)',
  ])

  // Get private transfer events
  const logs = await provider.getPrivateLogs({
    address: contractAddress,
    eventSignature: 'Transfer(address,address,uint256)',
  })

  console.log(`Found ${logs.length} private transfers`)

  for (const log of logs) {
    const parsed = sdInterface.parseLog(log)

    if (parsed?.innerLog) {
      const { from, to, value } = parsed.innerLog.args
      console.log(`Transfer: ${from} → ${to}: ${value.toString()}`)
    }
  }
}
```

## How Privacy Works

1. **On-Chain**: The `PrivateEvent` is stored like any other event - the data is there
2. **Custom RPC Filter**: When you call `eth_getLogs`, the Custom RPC:
   - Authenticates your request via signature
   - Checks each `PrivateEvent`'s `allowedViewers`
   - Only returns events where you're in the viewers list
3. **Client Decoding**: Your client decodes the `payload` using the event ABI

## Important Notes

### Privacy Limitations

1. **Indexed fields in payload are NOT indexed**: You cannot filter on payload contents
2. **Event type IS indexed**: You can filter by `eventType` (topic[1])
3. **Public nodes see everything**: Privacy is enforced by the Custom RPC, not the chain itself
4. **Payload must be decoded client-side**: The client needs the event ABI

### Best Practices

1. **Always include the ABI**: Share your event signatures with authorized viewers
2. **Use constants for event types**: Prevents typos and ensures consistency
3. **Keep viewer lists reasonable**: Large arrays increase gas costs
4. **Consider event type naming**: Use descriptive, unique names

### Gas Considerations

```solidity
// More viewers = more gas
address[] memory viewers = new address[](100); // Expensive!

// Consider using a role-based approach instead
function _getAuthorizedViewers() internal view returns (address[] memory) {
    // Return a predefined group
}
```

## Event Type Hashes

Calculate the event type hash:

```solidity
// In Solidity
bytes32 eventType = keccak256("Transfer(address,address,uint256)");
```

```typescript
// In TypeScript
import { keccak256, toUtf8Bytes } from 'ethers'
const eventType = keccak256(toUtf8Bytes('Transfer(address,address,uint256)'))
```

Common event type hashes:

| Event Signature                     | Hash            |
| ----------------------------------- | --------------- |
| `Transfer(address,address,uint256)` | `0xddf252ad...` |
| `Approval(address,address,uint256)` | `0x8c5be1e5...` |

## Debugging

### Event Not Showing Up?

1. **Check you're in allowedViewers**: The signing address must be in the array
2. **Check the event type hash**: Must match exactly
3. **Check the contract address**: Filter is correct
4. **Check block range**: Event might be outside your query range

### Decoding Fails?

1. **ABI mismatch**: Ensure SDInterface has the correct inner event signature
2. **Payload encoding**: Verify `abi.encode` matches the event signature
3. **Event type mismatch**: The hash must match the signature exactly
