// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Non-upgradeable contract used by `deploy-contract-static` tests.
contract StaticBox {
    string public label;

    constructor(string memory label_) {
        label = label_;
    }
}