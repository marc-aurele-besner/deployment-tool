// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal upgradeable contract used as a test fixture.
// Intentionally avoids `@openzeppelin/contracts-upgradeable` so the
// test project doesn't need that as a runtime dependency — the
// deployment-tool plugin's own peerDeps are the surface area we test.
contract GreeterV1 {
    string private _greeting;
    bool private _initialized;

    event GreetingSet(string greeting);

    function initialize(string memory greeting_) public {
        require(!_initialized, 'GreeterV1: already initialized');
        _initialized = true;
        _greeting = greeting_;
        emit GreetingSet(greeting_);
    }

    function greeting() public view returns (string memory) {
        return _greeting;
    }

    // Marker to distinguish implementations across upgrades.
    function version() public pure returns (string memory) {
        return 'V1';
    }
}