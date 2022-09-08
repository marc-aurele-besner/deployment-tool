[![license](https://img.shields.io/github/license/jamesisaac/react-native-background-task.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/deployment-tool.svg)](https://badge.fury.io/js/deployment-tool)

# Mainnet Deployment Tool

This Hardhat plugin add 4 tasks and 3 functions to deploy and upgrade smart contracts.

Step include : 
- Compile your contracts
- Verify storage layout, deploy a proxy admin if non existent, deploy implementation contract if non existent
- Get last commit id (8 first characters)
- Deploy a Transparent Upgradeable Proxy OR Upgrade Proxy using implementation contract
- Save address of the Proxy, Proxy Admin address and initialize arguments
- Verify contract on etherscan.io (if selected)
- Commit new storage layout file and address file with Contract Name and CommitId in commit msg
- Git Pull & Push

## How to install this package
### 1. Install this package
With NPM
```commandline
npm install deployment-tool
```
Or with Yarn
```commandline
yarn add deployment-tool
```

### 2. Import/Require this package in your hardhat.config.js/.ts

Inside inside hardhat.config.js
```
require("deployment-tool");
```
or inside hardhat.config.ts (Typescript)
```
import 'deployment-tool'
```

### Other option
<details>
<summary>Clone this repository and create a symlink</summary>

```
git clone https://github.com/marc-aurele-besner/deployment-tool

cd deployment-tool

npm install

npm run build

npm link
```

in the hardhat project, you want to use this plugin

```
npm link deployment-tool
```
</details>

## Tasks

```
npx hardhat deployment
npx hardhat deploy-contract
npx hardhat upgrade-contract
npx hardhat test-deploy-then-upgrade-contract
```

### Task: deploy-contract

Usage: hardhat [GLOBAL OPTIONS] deploy-contract [--contract-name <STRING>] [--extra <STRING>] [--initialize-arguments <STRING>] [--initialize-signature <STRING>] [--skip-git <STRING>] [--tag <STRING>] [--verify-contract <STRING>]

OPTIONS:

- --contract-name               The name of the contract to deploy (default: "")
- --extra                       Extra data to save with this deployment (default: "")
- --initialize-arguments        The initialize() argument (default: "")
- --initialize-signature        Function signature of the initialize function (default: "")
- --skip-git                    Skit git commit, pull & push (default: "false")
- --tag                         Add a extra tag to this version of the contract (default: "")
- --verify-contract             Validate the contract on Etherscan.io (default: "false")

deploy-contract: Deploy a proxy contract, initialize it, save the address, commit, pull and push

### Task: upgrade-contract

Usage: hardhat [GLOBAL OPTIONS] upgrade-contract [--contract-name <STRING>] [--extra <STRING>] [--skip-git <STRING>] [--tag <STRING>] [--verify-contract <STRING>]

OPTIONS:

- --contract-name       The name of the contract to deploy (default: "")
- --extra               Extra data to save with this deployment (default: "")
- --skip-git            Skit git commit, pull & push (default: "false")
- --tag                 Add a extra tag to this version of the contract (default: "")
- --verify-contract     Validate the contract on Etherscan.io (default: "false")

upgrade-contract: Upgrade a proxy contract, save the address, commit, pull and push

### Task: test-deploy-then-upgrade-contract

Usage: hardhat [GLOBAL OPTIONS] test-deploy-then-upgrade-contract [--contract-name <STRING>] [--extra <STRING>] [--initialize-arguments <STRING>] [--initialize-signature <STRING>] [--skip-git <STRING>] [--tag <STRING>] [--verify-contract <STRING>]

OPTIONS:

- --contract-name               The name of the contract to deploy (default: "")
- --extra                       Extra data to save with this deployment (default: "")
- --initialize-arguments        The initialize() argument (default: "")
- --initialize-signature        Function signature of the initialize function (default: "")
- --skip-git                    Skit git commit, pull & push (default: "false")
- --tag                         Add a extra tag to this version of the contract (default: "")
- --verify-contract             Validate the contract on Etherscan.io (default: "false")

test-deploy-then-upgrade-contract: Upgrade a proxy contract, save the address, commit, pull and push

## Functions

Function allow you to use the deployment OR upgrade script in scripts or tests files, they all return a instance of the contract that you can use.

```
    const { contractDeployment } = require('hardhat');

    contractDeployment.deployContract(
        contractName: string,
        initializeArguments: any[] = [],
        initializeSignature: string = 'initialize',
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verifyContract?: boolean
    )
    contractDeployment.upgradeContract(
        contractName: string,
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verifyContract?: boolean
    )
    contractDeployment.testDeployThenUpgradeContract(
        contractName: string,
        initializeArguments: any[] = [],
        initializeSignature: string = 'initialize',
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verifyContract?: boolean
    )
```

### Dependencies

This package/plugin use other hardhat plugins that you can then reuse, for example https://www.npmjs.com/package/hardhat-awesome-cli is used to save the contract address and initialization details, this can be access with a function like 
```
const { addressBook } = require('hardhat');
addressBook.retrieveContractObject(contractName: string, deployedNetwork: string)
```