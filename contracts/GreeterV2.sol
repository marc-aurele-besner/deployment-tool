// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// V2 of the upgradeable Greeter fixture. Keeps the V1 storage layout
// (only appends) and adds a setter so we can prove the upgrade worked.
contract GreeterV2 {
    string private _greeting;
    bool private _initialized;

    event GreetingSet(string greeting);

    function initialize(string memory greeting_) public {
        require(!_initialized, 'GreeterV2: already initialized');
        _initialized = true;
        _greeting = greeting_;
        emit GreetingSet(greeting_);
    }

    function greeting() public view returns (string memory) {
        return _greeting;
    }

    function setGreeting(string memory greeting_) public {
        _greeting = greeting_;
        emit GreetingSet(greeting_);
    }

    function version() public pure returns (string memory) {
        return 'V2';
    }
}