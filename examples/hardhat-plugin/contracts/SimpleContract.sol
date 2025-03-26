// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleContract {
  uint256 public constant MY_CONSTANT = 42;

  function getConstant() public pure returns (uint256) {
    return MY_CONSTANT;
  }
}