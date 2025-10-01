// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PrivateToken is ERC20 {
    error UnauthorizedBalanceQuery(address requester, address account);

    constructor(uint256 initialSupply) ERC20("PrivateToken", "PTK") {
        _mint(msg.sender, initialSupply);
    }

    function balanceOf(address account) public view override returns (uint256) {
        if (account != msg.sender) {
            revert UnauthorizedBalanceQuery(msg.sender, account);
        }
        return super.balanceOf(account);
    }
}