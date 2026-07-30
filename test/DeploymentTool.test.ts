import { strict as assert } from 'assert'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { upgrades as upgradesFactory } from '@openzeppelin/hardhat-upgrades'
import { AwesomeAddressBook } from 'hardhat-awesome-cli/plugin'
import hre from 'hardhat'

import { ContractDeployment, createContractDeployment } from '../src/lib.js'

/**
 * The `AwesomeAddressBook` from `hardhat-awesome-cli` is filesystem-backed:
 * `saveContract` writes JSON files under `addressBook.savePath`, and
 * `retrieveContract` reads them back. Hardhat 3 no longer supports the v2
 * trick of monkey-patching `hre.addressBook`, so each test points a fresh
 * `AwesomeAddressBook` at a per-test temp directory and reads it back to
 * verify recorded deployments.
 */
class TempAddressBook {
    public readonly book: AwesomeAddressBook
    public readonly directory: string
    public readonly savePath: string

    constructor(network = 'hardhat') {
        this.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deployment-tool-test-'))
        // `AwesomeAddressBook` concatenates `savePath + filename` without a
        // separator, so trailing-slash the directory ourselves; otherwise the
        // JSON files end up next to the temp dir instead of inside it.
        this.savePath = this.directory + path.sep
        this.book = new AwesomeAddressBook(
            {
                addressBook: {
                    savePath: this.savePath,
                    openzeppelinPath: this.savePath,
                    contractsFlattenPath: 'contractsFlatten',
                    contractsFlattenPrefix: 'flat_',
                    fileHardhatAwesomeCLI: 'hardhat-awesome-cli.json',
                    fileEnvHardhatAwesomeCLI: '.env.hardhat-awesome-cli',
                    fileContractsAddressDeployed: 'contractsAddressDeployed.json',
                    fileContractsAddressDeployedHistory: 'contractsAddressDeployedHistory.json'
                }
            },
            network
        )
    }

    public readDeployed(): Array<{ name: string; address: string; network: string }> {
        const file = path.join(this.savePath, 'contractsAddressDeployed.json')
        if (!fs.existsSync(file)) return []
        return JSON.parse(fs.readFileSync(file, 'utf8'))
    }

    public cleanup() {
        try {
            fs.rmSync(this.directory, { recursive: true, force: true })
        } catch {
            /* temp dir cleanup is best-effort */
        }
    }
}

describe('deployment-tool plugin', function () {
    let connection: any
    let book: TempAddressBook

    // The OZ plugin + compile + on-chain deploys take a few seconds.
    this.timeout(120_000)

    beforeEach(async function () {
        book = new TempAddressBook()
        connection = await hre.network.connect()
    })

    afterEach(function () {
        book.cleanup()
    })

    describe('plugin registration', function () {
        it('exports a ContractDeployment class with the expected API', function () {
            assert.equal(typeof ContractDeployment, 'function', 'ContractDeployment class should be exported')
            const proto = ContractDeployment.prototype
            assert.equal(typeof proto.deployContract, 'function')
            assert.equal(typeof proto.upgradeContract, 'function')
            assert.equal(typeof proto.deployContractStatic, 'function')
            assert.equal(typeof proto.testDeployThenUpgradeContract, 'function')
        })

        it('registers the deploy/upgrade tasks', function () {
            for (const name of [
                'deployment',
                'deploy-contract',
                'upgrade-contract',
                'deploy-contract-static',
                'test-deploy-then-upgrade-contract'
            ]) {
                assert.ok(hre.tasks.getTask(name), `task "${name}" should be registered`)
            }
        })

        it('resolves `paths.deployment` via the config hook', function () {
            assert.ok(hre.config.paths.deployment, 'paths.deployment should be set')
        })
    })

    describe('deployContract (proxy)', function () {
        it('deploys an upgradeable proxy and runs the initializer', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const result = await cd.deployContract(
                'GreeterV1',
                ['hello'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )

            assert.equal(result.success, true, 'deploy should report success: ' + result.message)
            assert.equal(result.contractName, 'GreeterV1')
            assert.ok(result.proxyAddress, 'proxyAddress should be returned')
            assert.ok(result.contract, 'contract instance should be returned')
            assert.equal(result.proxyAddress, result.contract.target)
            assert.ok(result.proxyAdminAddress, 'proxyAdminAddress should be returned')
            assert.match(result.proxyAdminAddress!, /^0x[0-9a-fA-F]{40}$/)

            const upgrades = await upgradesFactory(hre, connection)
            const onChainAdmin = await upgrades.erc1967.getAdminAddress(result.proxyAddress!)
            assert.equal(result.proxyAdminAddress!.toLowerCase(), onChainAdmin.toLowerCase())

            const greeting = await result.contract.greeting()
            assert.equal(greeting, 'hello')

            assert.equal(await result.contract.version(), 'V1')

            const stored = book.readDeployed().find((c) => c.name === 'GreeterV1')
            assert.ok(stored, 'address book should have recorded the deployment')
            assert.equal(stored!.address, result.proxyAddress)

            const storedAdmin = book.readDeployed().find((c) => c.name === 'ProxyAdmin')
            assert.ok(storedAdmin, 'address book should have recorded the ProxyAdmin')
            assert.equal(storedAdmin!.address.toLowerCase(), onChainAdmin.toLowerCase())
        })

        it('records the reused ProxyAdmin when deploying another proxy', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const first = await cd.deployContract(
                'GreeterV1',
                ['first'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            const second = await cd.deployContract(
                'GreeterV1',
                ['second'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )

            assert.equal(first.success, true)
            assert.equal(second.success, true)
            assert.ok(second.proxyAdminAddress)

            const upgrades = await upgradesFactory(hre, connection)
            const onChainAdmin = await upgrades.erc1967.getAdminAddress(second.proxyAddress!)
            assert.equal(second.proxyAdminAddress!.toLowerCase(), onChainAdmin.toLowerCase())

            const storedAdmin = book.readDeployed().find((c) => c.name === 'ProxyAdmin')
            assert.ok(storedAdmin, 'address book should retain the reused ProxyAdmin')
            assert.equal(storedAdmin!.address.toLowerCase(), onChainAdmin.toLowerCase())
        })

        it('uses the provided initializer signature', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const result = await cd.deployContract(
                'GreeterV1',
                ['howdy'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            assert.equal(result.success, true)
            assert.equal(await result.contract.greeting(), 'howdy')
        })

        it('exposes a retrievable implementation address distinct from the proxy', async function () {
            // The deployment flow looks up the implementation contract via the
            // ERC-1967 slot when `verify` is true and forwards it to Etherscan.
            // Make sure the lookup is wired up correctly: after a deploy the
            // implementation address should resolve, look like an address, and
            // not equal the proxy.
            const cd = createContractDeployment(hre, connection, book.book)
            const result = await cd.deployContract(
                'GreeterV1',
                ['hello'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            assert.equal(result.success, true)

            const upgrades = await upgradesFactory(hre, connection)
            const implementationAddress = await upgrades.erc1967.getImplementationAddress(result.proxyAddress!)
            assert.match(implementationAddress, /^0x[0-9a-fA-F]{40}$/)
            assert.notEqual(implementationAddress.toLowerCase(), result.proxyAddress!.toLowerCase())
        })
    })

    describe('upgradeContract', function () {
        it('preserves storage and exposes the new implementation', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const deployed = await cd.deployContract(
                'GreeterV1',
                ['original'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            assert.equal(deployed.success, true)
            const proxyAddress = deployed.proxyAddress!

            // Pre-register the V2 entry pointing at the V1 proxy so the
            // upgrade flow can resolve it via the address book.
            book.book.saveContract('GreeterV2', proxyAddress, connection.networkName, '')

            const upgraded = await cd.upgradeContract('GreeterV2', undefined, undefined, true, false)
            assert.equal(upgraded.success, true)
            assert.equal(upgraded.proxyAddress, proxyAddress, 'proxy address should be unchanged')
            assert.ok(upgraded.proxyAdminAddress, 'proxyAdminAddress should be returned')
            assert.equal(upgraded.proxyAdminAddress!.toLowerCase(), deployed.proxyAdminAddress!.toLowerCase())

            const GreeterV2 = await connection.ethers.getContractFactory('GreeterV2')
            const proxied = GreeterV2.attach(proxyAddress)

            assert.equal(await proxied.greeting(), 'original')
            assert.equal(await proxied.version(), 'V2')
            await proxied.setGreeting('updated')
            assert.equal(await proxied.greeting(), 'updated')
        })

        it('returns failure when the proxy is not in the address book', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const upgraded = await cd.upgradeContract('GreeterV1', undefined, undefined, true, false)
            assert.equal(upgraded.success, false)
            assert.match(upgraded.message, /Upgrade failed/)
        })

        // Issue #99: upgrading GreeterV1 -> GreeterV2 used to require
        // manually saving the V2 name mapped to the V1 proxy address in
        // the address book before calling upgradeContract('GreeterV2').
        // The `from` option lets the caller point at the previous contract
        // name so the address-book lookup finds the V1 proxy without that
        // manual seeding step.
        it('upgrades via --from without pre-seeding the address book (issue #99)', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const deployed = await cd.deployContract(
                'GreeterV1',
                ['original'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            assert.equal(deployed.success, true)
            const proxyAddress = deployed.proxyAddress!
            assert.match(proxyAddress, /^0x[0-9a-fA-F]{40}$/)

            // No pre-seeding: only the V1 entry should exist. Confirm
            // GreeterV2 is absent before the upgrade so we know the
            // success below is from `from: 'GreeterV1'` resolving the
            // proxy, not from a leftover seed.
            assert.equal(
                book.book.retrieveContract('GreeterV2', connection.networkName),
                '',
                'GreeterV2 must not be in the address book before the upgrade'
            )

            const upgraded = await cd.upgradeContract(
                'GreeterV2',
                undefined,
                undefined,
                true,
                false,
                undefined,
                'GreeterV1'
            )
            assert.equal(upgraded.success, true)
            assert.equal(upgraded.proxyAddress, proxyAddress, 'proxy address must be unchanged')
            assert.equal(upgraded.contractName, 'GreeterV2')

            // The upgrade must save the new name (GreeterV2) under the
            // same proxy address so subsequent lookups succeed.
            assert.equal(
                book.book.retrieveContract('GreeterV2', connection.networkName),
                proxyAddress
            )

            const GreeterV2 = await connection.ethers.getContractFactory('GreeterV2')
            const proxied = GreeterV2.attach(proxyAddress)
            assert.equal(await proxied.greeting(), 'original')
            assert.equal(await proxied.version(), 'V2')
        })

        it('upgrades via an explicit --proxy address without an address-book entry (issue #99)', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const deployed = await cd.deployContract(
                'GreeterV1',
                ['explicit'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            assert.equal(deployed.success, true)
            const proxyAddress = deployed.proxyAddress!

            // Wipe any pre-existing V2 entry so the upgrade can only
            // succeed via the explicit proxy address.
            book.book.saveContract('GreeterV2', '', connection.networkName, '')

            const upgraded = await cd.upgradeContract(
                'GreeterV2',
                undefined,
                undefined,
                true,
                false,
                proxyAddress
            )
            assert.equal(upgraded.success, true)
            assert.equal(upgraded.proxyAddress, proxyAddress)
            assert.equal(upgraded.contractName, 'GreeterV2')

            const GreeterV2 = await connection.ethers.getContractFactory('GreeterV2')
            const proxied = GreeterV2.attach(proxyAddress)
            assert.equal(await proxied.version(), 'V2')
        })

        it('prefers --proxy over --from and --contract-name when resolving the proxy address (issue #99)', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const deployed = await cd.deployContract(
                'GreeterV1',
                ['precedence'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            const realProxyAddress = deployed.proxyAddress!

            // Seed a misleading V2 entry under a different address — if
            // --from / --contract-name takes precedence over --proxy the
            // upgrade would target this bogus address and fail.
            const bogusAddress = '0x0000000000000000000000000000000000000bbb'
            book.book.saveContract('GreeterV2', bogusAddress, connection.networkName, '')

            const upgraded = await cd.upgradeContract(
                'GreeterV2',
                undefined,
                undefined,
                true,
                false,
                realProxyAddress,
                'GreeterV1'
            )
            assert.equal(upgraded.success, true)
            assert.equal(upgraded.proxyAddress, realProxyAddress, 'proxy resolution must use --proxy first')
        })

        it('reports failure when neither --proxy, --from, nor an address-book entry resolves a contract (issue #99)', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            // No deploy, no address-book entries — neither --proxy nor
            // --from is set, so the lookup under --contract-name fails.
            const upgraded = await cd.upgradeContract('MissingV1', undefined, undefined, true, false)
            assert.equal(upgraded.success, false)
            assert.match(upgraded.message, /Upgrade failed/)
        })

        it('rotates the implementation address to a new one on upgrade', async function () {
            // The upgrade flow re-resolves the implementation address after
            // upgradeProxy and forwards it to Etherscan. Verify the slot
            // changes (so the verification call would actually verify the
            // new logic, not the old one).
            const cd = createContractDeployment(hre, connection, book.book)
            const deployed = await cd.deployContract(
                'GreeterV1',
                ['original'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            const proxyAddress = deployed.proxyAddress!
            book.book.saveContract('GreeterV2', proxyAddress, connection.networkName, '')

            const upgrades = await upgradesFactory(hre, connection)
            const implBefore = await upgrades.erc1967.getImplementationAddress(proxyAddress)
            assert.match(implBefore, /^0x[0-9a-fA-F]{40}$/)

            const upgraded = await cd.upgradeContract('GreeterV2', undefined, undefined, true, false)
            assert.equal(upgraded.success, true)

            const implAfter = await upgrades.erc1967.getImplementationAddress(proxyAddress)
            assert.match(implAfter, /^0x[0-9a-fA-F]{40}$/)
            assert.notEqual(implAfter.toLowerCase(), implBefore.toLowerCase())
        })
    })

    // Issue #97: `upgradeProxy` used to declare `verifyContractFlag?: boolean`
    // (undefined default), so `if (verifyContractFlag)` was falsy and every
    // upgrade that didn't pass the flag explicitly skipped Etherscan
    // verification — silently diverging from `deployProxy` / `deploy`. The
    // fix changes the default to `true`. These tests pin the new behaviour:
    // omitting `verifyContractFlag` (or letting the `ContractDeployment`
    // wrapper forward `undefined`) must enter the verification branch.
    describe('verifyContract default (issue #97)', function () {
        // The verification branch calls `etherscanVerifyContract`, which on
        // the local hardhat network can't actually publish to Etherscan and
        // logs an error via `console.log` instead of throwing. Either a
        // success log or an error log proves the verify branch ran.
        const captureConsoleLog = () => {
            const messages: string[] = []
            const original = console.log
            console.log = (...args: unknown[]) => {
                messages.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '))
                return original.apply(console, args as any)
            }
            return {
                messages,
                restore: () => {
                    console.log = original
                }
            }
        }

        const verifyBranchEntered = (messages: string[]) =>
            messages.some(
                (m) => m.includes('has been verified on etherscan.io') || m.includes('Error verifying contract')
            )

        it('upgradeProxy enters the verification branch when verifyContractFlag is undefined', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const deployed = await cd.deployContract(
                'GreeterV1',
                ['default-flag'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            assert.equal(deployed.success, true)
            const proxyAddress = deployed.proxyAddress!
            book.book.saveContract('GreeterV2', proxyAddress, connection.networkName, '')

            const capture = captureConsoleLog()
            try {
                // Forward `undefined` for verifyContractFlag — the function
                // signature must now default to `true` (issue #97).
                const upgraded = await cd.upgradeContract('GreeterV2', undefined, undefined, true, undefined)
                assert.equal(upgraded.success, true)
            } finally {
                capture.restore()
            }

            assert.ok(
                verifyBranchEntered(capture.messages),
                'upgradeProxy should attempt verification when verifyContractFlag is omitted'
            )
        })

        it('upgradeProxy skips the verification branch when verifyContractFlag is false', async function () {
            // Regression guard for the explicit `false` path — must still
            // skip verification regardless of the new default.
            const cd = createContractDeployment(hre, connection, book.book)
            const deployed = await cd.deployContract(
                'GreeterV1',
                ['explicit-false'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )
            const proxyAddress = deployed.proxyAddress!
            book.book.saveContract('GreeterV2', proxyAddress, connection.networkName, '')

            const capture = captureConsoleLog()
            try {
                const upgraded = await cd.upgradeContract('GreeterV2', undefined, undefined, true, false)
                assert.equal(upgraded.success, true)
            } finally {
                capture.restore()
            }

            assert.equal(
                verifyBranchEntered(capture.messages),
                false,
                'upgradeProxy must skip verification when verifyContractFlag is explicitly false'
            )
        })

        it('deployProxy enters the verification branch when verifyContractFlag is undefined', async function () {
            // The deploy path already defaulted to `true` before the fix;
            // this pins that behaviour so a future refactor can't
            // accidentally regress it back to the upgrade bug.
            const cd = createContractDeployment(hre, connection, book.book)

            const capture = captureConsoleLog()
            try {
                const result = await cd.deployContract(
                    'GreeterV1',
                    ['default-flag-deploy'],
                    'initialize',
                    undefined,
                    undefined,
                    true,
                    undefined
                )
                assert.equal(result.success, true)
            } finally {
                capture.restore()
            }

            assert.ok(
                verifyBranchEntered(capture.messages),
                'deployProxy should attempt verification when verifyContractFlag is omitted'
            )
        })
    })

    describe('testDeployThenUpgradeContract', function () {
        it('deploys then performs a same-name upgrade round-trip', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const result = await cd.testDeployThenUpgradeContract(
                'GreeterV1',
                ['start'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )

            assert.equal(result.success, true, 'final upgrade should succeed')
            assert.equal(result.contractName, 'GreeterV1')
            assert.ok(result.proxyAddress, 'proxyAddress should be returned')
            assert.equal(await result.contract.version(), 'V1')
            assert.equal(await result.contract.greeting(), 'start')
        })
    })

    describe('deployContractStatic', function () {
        it('deploys a non-upgradeable contract with constructor arguments', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const result = await cd.deployContractStatic('StaticBox', ['my-label'], undefined, undefined, true, false)

            assert.equal(result.success, true)
            assert.equal(result.contractName, 'StaticBox')
            assert.ok(result.address, 'address should be returned')
            assert.equal(result.address, result.contract.target)

            const StaticBox = await connection.ethers.getContractFactory('StaticBox')
            const onChain = StaticBox.attach(result.address!)
            assert.equal(await onChain.label(), 'my-label')
        })
    })

    // Regression coverage for #98: when `hardhat build` fails the deploy
    // / upgrade flows must abort before signing transactions, not silently
    // continue with stale artifacts. We drop a deliberately broken Solidty
    // file into `contracts/` for the duration of this block and make sure
    // it is removed afterwards so the rest of the suite can compile again.
    describe('compile failure handling', function () {
        const brokenContractPath = path.join('contracts', '__BrokenForCompileTest.sol')
        const brokenContractSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract __BrokenForCompileTest {
    this is not valid solidity;
}
`

        this.timeout(120_000)

        before(function () {
            fs.writeFileSync(brokenContractPath, brokenContractSource)
        })

        after(function () {
            try {
                fs.unlinkSync(brokenContractPath)
            } catch {
                /* best-effort cleanup */
            }
        })

        it('aborts deployContractStatic with success: false when contracts fail to build', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const result = await cd.deployContractStatic('GreeterV1', ['hello'], undefined, undefined, true, false)

            assert.equal(result.success, false)
            assert.equal(result.message, 'Compilation failed')
            assert.match(result.error!, /aborting deployment/)
            assert.equal(result.contract, undefined, 'no contract instance should be returned')
            assert.equal(result.address, undefined, 'no address should be returned')
        })

        it('aborts deployContract (proxy) with success: false when contracts fail to build', async function () {
            const cd = createContractDeployment(hre, connection, book.book)
            const result = await cd.deployContract(
                'GreeterV1',
                ['hello'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )

            assert.equal(result.success, false)
            assert.equal(result.message, 'Compilation failed')
            assert.match(result.error!, /aborting deployment/)
            assert.equal(result.contract, undefined, 'no proxy instance should be returned')
            assert.equal(result.proxyAddress, undefined, 'no proxy address should be returned')
        })

        it('aborts upgradeContract with success: false when contracts fail to build', async function () {
            // Pre-seed the address book so the upgrade flow passes the
            // "not in address book" check and the abort comes from the
            // compile failure, not the lookup.
            book.book.saveContract(
                'GreeterV2',
                '0x0000000000000000000000000000000000000000',
                connection.networkName,
                ''
            )

            const cd = createContractDeployment(hre, connection, book.book)
            const result = await cd.upgradeContract('GreeterV2', undefined, undefined, true, false)

            assert.equal(result.success, false)
            assert.equal(result.message, 'Compilation failed')
            assert.match(result.error!, /aborting upgrade/)
            assert.equal(result.contract, undefined, 'no upgraded contract should be returned')
        })
    })
})
