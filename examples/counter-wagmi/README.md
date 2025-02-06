# Silent Data Rollup Counter Example with Wagmi

This example demonstrates how to integrate the Silent Data Rollup (SDR) plugin with a React application using Wagmi and Viem. The example features a simple counter contract interaction that showcases the privacy-preserving capabilities of Silent Data Rollup.

## Features

- React + TypeScript + Vite setup
- Integration with Silent Data Rollup using the viem plugin
- Rainbow Kit for wallet connection
- TailwindCSS for styling
- Counter contract interaction example
- Toast notifications for transaction status

## Privacy Features

The Counter example showcases key privacy-preserving features of Silent Data Rollup:

### Ownership and Counter Privacy

- **Count Value Privacy**: The counter's value is only visible to the current owner of the counter
- **Ownership Management**: 
  - Anyone can claim ownership of the counter
  - Once claimed, only the current owner can view the current count value
  - Other users will see the count value as hidden/encrypted
  - Any user can increment, decrement or reset the counter
- **Private State**: This demonstrates how SDR can maintain private state that's only accessible to authorized addresses

### How It Works

1. When a user claims ownership, they become the authorized viewer of the counter's state
2. The counter value is stored in the counter contract state and can only be revealed if request is signed by current owner
3. When ownership changes, the previous owner loses access to view the counter value
4. All transactions (increment, decrement, claim, reset) are processed as any other contract transaction

This pattern can be applied to other applications where data should only be visible to specific authorized addresses.

## Prerequisites

- Node.js (version 18 or higher)
- Yarn or npm
- Access to a Silent Data Rollup RPC endpoint

## Getting Started

1. Clone this repository
2. Navigate to the example directory:
   ```bash
   cd examples/counter-wagmi
   ```
3. Install dependencies:
   ```bash
   yarn install
   ```
4. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your:
   - `VITE_SDR_RPC_URL`: Your Silent Data Rollup RPC endpoint
   - Other required environment variables

5. Start the development server:
   ```bash
   yarn dev
   ```

## Project Structure

- `src/`
  - `components/` - React components including Counter and Toast notifications
  - `hooks/` - Custom React hooks for contract interactions and UI state
  - `config.ts` - Wagmi and chain configuration
  - `App.tsx` - Main application component
- `contract.json` - ABI and contract deployment information
- Configuration files for TypeScript, Vite, and other tools

## Key Dependencies

- `@appliedblockchain/silentdatarollup-viem-plugin`: Silent Data Rollup integration
- `@rainbow-me/rainbowkit`: Wallet connection UI
- `wagmi`: React Hooks for Ethereum
- `viem`: Low-level Ethereum interactions
- `@tanstack/react-query`: Data synchronization

## Development

### Available Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production

## Using the Silent Data Rollup Plugin

This example demonstrates how to:

1. Configure the SDR plugin with Wagmi
2. Use privacy-preserving contract interactions
3. Handle transaction notifications
4. Manage wallet connections with Rainbow Kit

### Counter Contract Sample Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Counter
 * @dev A simple counter contract that can increment and decrement a value
 */

import "hardhat/console.sol";

contract Counter {
    // State variable
    uint256 private count;
    address private owner;
    address private deployer;

    // Events
    event CounterUpdated(address account);
    event NewOwner(address newOwner);

    // Constructor
    constructor(uint256 initialCount) {
        count = initialCount;
        deployer = msg.sender;
        owner = deployer; // Set deployer as initial owner
    }

    /**
     * @dev Returns the current count
     */
    function getCount() public view returns (uint256) {
        return count;
    }

    function getCountPrivate() public view returns (uint256) {
        console.log(msg.sender);
        console.log(deployer);
        if (msg.sender != deployer) {
            require(msg.sender == owner, 'not the owner');
        }
        return count;
    }

    /**
     * @dev Increments the counter by 1
     */
    function increment() public {
        count += 1;
        emit CounterUpdated(msg.sender);
    }

    /**
     * @dev Decrements the counter by 1
     */
    function decrement() public {
        count -= 1;
        emit CounterUpdated(msg.sender);
    }

    /**
     * @dev Resets the counter to zero
     */
    function reset() public {
        count = 0;
        emit CounterUpdated(msg.sender);
    }

    /**
     * @dev Returns the current owner of the contract
     */
    function getOwner() public view returns (address) {
        return owner;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function setOwner() public {
        owner = msg.sender;
        emit NewOwner(msg.sender);
    }
}

```

## Additional Resources

- [Silent Data Rollup Documentation](https://docs.silentdata.com)
- [Wagmi Documentation](https://wagmi.sh)
- [Viem Documentation](https://viem.sh)
- [Rainbow Kit Documentation](https://www.rainbowkit.com/docs/introduction) 