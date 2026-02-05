// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PrivateToken
 * @notice ERC-20 token where only the account owner can view their balance.
 * @dev On Silent Data, msg.sender is available in view functions when called
 *      through the authenticated RPC, enabling private balance queries.
 */
contract PrivateToken is ERC20 {
    /// @notice Thrown when someone tries to query another user's balance
    error UnauthorizedBalanceQuery(address requester, address account);

    /**
     * @param name Token name
     * @param symbol Token symbol  
     * @param initialSupply Initial supply minted to deployer
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @notice Returns the balance of an account - only callable by the account owner
     * @param account The account to query
     * @return The account's balance
     */
    function balanceOf(address account) public view override returns (uint256) {
        if (account != msg.sender) {
            revert UnauthorizedBalanceQuery(msg.sender, account);
        }
        return super.balanceOf(account);
    }
}
