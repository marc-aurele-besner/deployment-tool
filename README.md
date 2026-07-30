# deployment-tool

[![license](https://img.shields.io/github/license/marc-aurele-besner/deployment-tool.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/deployment-tool.svg)](https://badge.fury.io/js/deployment-tool)

A Hardhat 3 plugin that adds tasks and a programmatic API to deploy and upgrade smart contracts.

Each run will:

1. Compile your contracts.
2. Verify the storage layout and, when needed, deploy a proxy admin and an implementation contract.
3. Use the first 8 characters of the current commit id as a version tag.
4. Deploy a Transparent Upgradeable Proxy, or upgrade an existing proxy to the new implementation.
5. Save the proxy address, proxy admin address, and initialization arguments.
6. Verify the contract on Etherscan when verification is enabled (on by default).
7. Commit the storage-layout and address files with a `<ContractName> @<commitId>` message, and `git pull --rebase && git push`.

## Installation

```bash
npm install --save-dev deployment-tool \
    hardhat \
    @nomicfoundation/hardhat-ethers \
    @nomicfoundation/hardhat-verify \
    @openzeppelin/hardhat-upgrades \
    hardhat-awesome-cli
```

These are listed as `peerDependencies` and are **not** installed automatically.

## Configuration

Hardhat 3 is declarative — register the plugin in the `plugins` array of `hardhat.config.ts`. The recommended setup is:

```ts
import hardhatToolboxMochaEthersPlugin from '@nomicfoundation/hardhat-toolbox-mocha-ethers'
import hardhatAwesomeCliPlugin from 'hardhat-awesome-cli/plugin'
import ozUpgradesPlugin from '@openzeppelin/hardhat-upgrades'
import { defineConfig } from 'hardhat/config'
import deploymentToolPlugin from 'deployment-tool'

export default defineConfig({
    plugins: [
        hardhatToolboxMochaEthersPlugin,
        ozUpgradesPlugin,
        hardhatAwesomeCliPlugin,
        deploymentToolPlugin
    ],
    solidity: { profiles: { default: { version: '0.8.20' } } }
})
```

You can also point the deployment folder elsewhere:

```ts
export default defineConfig({
    paths: { deployment: 'deploy' }, // resolved relative to the Hardhat root
    plugins: [/* ... */]
})
```

An absolute path is passed through unchanged; otherwise the value is resolved against `paths.root`. The default is `<root>/deployment`.

## Tasks

The plugin registers five tasks:

| Task | Description |
| --- | --- |
| `deployment` | Interactive menu that asks which task to run |
| `deploy-contract` | Deploy an upgradeable proxy, initialize it, save the address, commit, pull, and push |
| `upgrade-contract` | Upgrade an existing proxy, save the address, commit, pull, and push |
| `deploy-contract-static` | Deploy a non-upgradeable contract, save the address, commit, pull, and push |
| `test-deploy-then-upgrade-contract` | Deploy then upgrade a proxy in a single call (useful for local tests) |

Run any of them with `npx hardhat <task>` or `deployment-tool <task>`.

### `deploy-contract`

```
hardhat deploy-contract \
    --contract-name <string> \
    --initialize-arguments <csv> \
    --initialize-signature <string> \
    --tag <string> \
    --extra <string> \
    --skip-git <true|false> \
    --verify-contract <true|false>
```

- `--initialize-arguments` is comma-separated and forwarded to the contract's `initialize` function.
- `--initialize-signature` defaults to `initialize` when omitted.
- `--verify-contract` defaults to `true`; pass `false` to skip Etherscan verification.
- `--skip-git` defaults to `false`; pass `true` to keep the working tree untouched.
- Omit `--contract-name` to answer the prompts interactively.

### `upgrade-contract`

```
hardhat upgrade-contract \
    --contract-name <string> \
    --tag <string> \
    --extra <string> \
    --skip-git <true|false> \
    --verify-contract <true|false>
```

### `deploy-contract-static`

```
hardhat deploy-contract-static \
    --contract-name <string> \
    --constructor-arguments <csv> \
    --tag <string> \
    --extra <string> \
    --skip-git <true|false> \
    --verify-contract <true|false>
```

- `--constructor-arguments` is comma-separated.

### `test-deploy-then-upgrade-contract`

Same options as `deploy-contract`.

### The `deployment-tool` binary

The package also ships a `deployment-tool` binary that lists tasks and forwards them to your project's Hardhat:

```bash
deployment-tool deploy-contract --contract-name MyContract   # equivalent to
npx hardhat deploy-contract --contract-name MyContract

deployment-tool --help       # list every task
deployment-tool --version    # print the installed version
```

## Programmatic API

Hardhat 3 removed the `extendEnvironment` hook this plugin used in Hardhat 2, so `hre.contractDeployment` is no longer attached. Use the `createContractDeployment` factory instead:

```ts
import hre from 'hardhat'
import { createContractDeployment } from 'deployment-tool/dist/lib.js'

const connection = await hre.network.connect()
const cd = createContractDeployment(hre, connection)

const result = await cd.deployContract(
    'GreeterV1',
    ['hello world'], // initialize arguments
    'initialize' // initialize function signature
)
```

`createContractDeployment` returns a `ContractDeployment` wrapper with the following methods:

```ts
cd.deployContract(
    contractName: string,
    initializeArguments: any[] = [],
    initializeSignature: string = 'initialize',
    tag?: string,
    extra?: any,
    skipGit?: boolean,
    verify?: boolean
)

cd.upgradeContract(
    contractName: string,
    tag?: string,
    extra?: any,
    skipGit?: boolean,
    verify?: boolean
)

cd.testDeployThenUpgradeContract(
    contractName: string,
    initializeArguments: any[] = [],
    initializeSignature: string = 'initialize',
    tag?: string,
    extra?: any,
    skipGit?: boolean,
    verify?: boolean
)

cd.deployContractStatic(
    contractName: string,
    constructorArguments: any[] = [],
    tag?: string,
    extra?: any,
    skipGit?: boolean,
    verify?: boolean
)
```

Returns are result objects, not contract instances. Proxy deploy/upgrade calls return `{ success, message, contractName, contract, proxyAddress, proxyAdminAddress, error? }`; static deploys return `{ success, message, contractName, contract, address, error? }`. Compilation failures return `{ success: false, message: 'Compilation failed', error }` without throwing.

## Saving addresses with `hardhat-awesome-cli`

The plugin writes deployment metadata via [`hardhat-awesome-cli`](https://www.npmjs.com/package/hardhat-awesome-cli). `AwesomeAddressBook` is constructed per connection — read it back from your own scripts:

```ts
import { AwesomeAddressBook } from 'hardhat-awesome-cli/plugin'

const connection = await hre.network.connect()
const book = new AwesomeAddressBook(hre.config as any, connection.networkName)

const { address, initializeArguments } = book.retrieveContractObject('GreeterV1', connection.networkName)
```

## Local development

<details>
<summary>Clone this repository and create a symlink</summary>

```bash
git clone https://github.com/marc-aurele-besner/deployment-tool
cd deployment-tool
npm install
npm run build
npm link
```

In the Hardhat project where you want to use the plugin:

```bash
npm link deployment-tool
```

</details>

## Peer dependencies

- `hardhat ^3.0.0`
- `@nomicfoundation/hardhat-ethers ^4.0.0`
- `@nomicfoundation/hardhat-verify ^3.0.10`
- `@openzeppelin/hardhat-upgrades ^4.0.0`
- `hardhat-awesome-cli ^0.7.2`

## License

[MIT](./LICENSE)