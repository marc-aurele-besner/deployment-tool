import { strict as assert } from 'assert'
import fs from 'fs'
import os from 'os'
import path from 'path'

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

            const greeting = await result.contract.greeting()
            assert.equal(greeting, 'hello')

            assert.equal(await result.contract.version(), 'V1')

            const stored = book.readDeployed().find((c) => c.name === 'GreeterV1')
            assert.ok(stored, 'address book should have recorded the deployment')
            assert.equal(stored!.address, result.proxyAddress)
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
})
