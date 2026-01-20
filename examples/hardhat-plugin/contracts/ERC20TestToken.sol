// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ERC20TestToken is ERC20 {
    constructor() ERC20("ERC20 Test Token", "tERC20") {
        _mint(msg.sender, 1_000_000 ether);
    }
}