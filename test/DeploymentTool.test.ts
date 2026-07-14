import { strict as assert } from 'assert'
import { ethers, network } from 'hardhat'
import type { HardhatRuntimeEnvironment } from 'hardhat/types'

/**
 * In-memory replacement for `hardhat-awesome-cli`'s `AwesomeAddressBook`.
 *
 * The real implementation is gated on non-local networks — on `hardhat`,
 * `localhost`, and `anvil`, `saveContract` returns without writing anything.
 * That would break `upgradeProxy`, which calls `retrieveContract` and
 * expects the previously-deployed proxy address to be there.
 *
 * This stub records saves in a Map so the plugin's flow runs end-to-end
 * inside an in-memory network without ever touching the filesystem.
 */
class InMemoryAddressBook {
    private readonly records = new Map<string, any>()

    private static key(name: string, network: string) {
        return `${network}::${name}`
    }

    public saveContract(
        contractName: string,
        contractAddress: string,
        deployedNetwork: string,
        _deployer: string,
        _chainId?: number,
        _blockHash?: string,
        _blockNumber?: number,
        tag?: string,
        extra?: any,
        _forceSave?: boolean
    ) {
        this.records.set(InMemoryAddressBook.key(contractName, deployedNetwork), {
            name: contractName,
            address: contractAddress,
            network: deployedNetwork,
            tag: tag ?? '',
            extra: extra ?? {}
        })
    }

    public retrieveContract(contractName: string, deployedNetwork: string): string {
        return this.records.get(InMemoryAddressBook.key(contractName, deployedNetwork))?.address ?? ''
    }

    public retrieveContractObject(contractName: string, deployedNetwork: string) {
        return this.records.get(InMemoryAddressBook.key(contractName, deployedNetwork))
    }

    public retrieveOZAdminProxyContract(_chainId: number): string {
        // The plugin calls this on the deploy path inside a try/catch and
        // uses the result for logging only — a deterministic placeholder is fine.
        return '0x0000000000000000000000000000000000000000'
    }

    public retrieveContractHistory(_deployedNetwork: string): any[] {
        return Array.from(this.records.values())
    }

    public has(contractName: string, deployedNetwork: string): boolean {
        return this.records.has(InMemoryAddressBook.key(contractName, deployedNetwork))
    }
}

describe('deployment-tool plugin', function () {
    let hre: HardhatRuntimeEnvironment
    let book: InMemoryAddressBook

    // The OZ plugin + compile + on-chain deploys take a few seconds.
    this.timeout(120_000)

    beforeEach(function () {
        hre = require('hardhat')
        book = new InMemoryAddressBook()
        // Monkey-patch the runtime so the plugin reads/writes our stub.
        ;(hre as any).addressBook = book
    })

    describe('plugin registration', function () {
        it('extends the hardhat runtime with `contractDeployment`', function () {
            assert.ok(hre.contractDeployment, 'hre.contractDeployment should be defined')
            assert.equal(typeof hre.contractDeployment.deployContract, 'function')
            assert.equal(typeof hre.contractDeployment.upgradeContract, 'function')
            assert.equal(typeof hre.contractDeployment.deployContractStatic, 'function')
            assert.equal(typeof hre.contractDeployment.testDeployThenUpgradeContract, 'function')
        })

        it('registers the deploy/upgrade tasks', function () {
            const tasks = hre.tasks
            for (const name of [
                'deployment',
                'deploy-contract',
                'upgrade-contract',
                'deploy-contract-static',
                'test-deploy-then-upgrade-contract'
            ]) {
                assert.ok(tasks[name], `task "${name}" should be registered`)
            }
        })

        it('sets `paths.deployment` via extendConfig', function () {
            assert.ok(hre.config.paths.deployment, 'paths.deployment should be set')
            assert.match(
                hre.config.paths.deployment,
                /deployment$/,
                'paths.deployment should default to a "deployment" folder under the project root'
            )
        })
    })

    describe('deployContract (proxy)', function () {
        it('deploys an upgradeable proxy and runs the initializer', async function () {
            const result = await hre.contractDeployment.deployContract(
                'GreeterV1',
                ['hello'],
                'initialize',
                undefined,
                undefined,
                true, // skipGit — never touch git in tests
                false // verifyContract — never touch etherscan in tests
            )

            assert.equal(result.success, true, 'deploy should report success')
            assert.equal(result.contractName, 'GreeterV1')
            assert.ok(result.proxyAddress, 'proxyAddress should be returned')
            assert.ok(result.contract, 'contract instance should be returned')
            assert.equal(result.proxyAddress, result.contract.address)

            // The proxy should be callable through the V1 ABI.
            const greeting = await result.contract.greeting()
            assert.equal(greeting, 'hello')

            assert.equal(await result.contract.version(), 'V1')

            // Address book should have recorded the deployment.
            const stored = book.retrieveContract('GreeterV1', network.name)
            assert.equal(stored, result.proxyAddress)
        })

        it('uses the provided initializer signature', async function () {
            const result = await hre.contractDeployment.deployContract(
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
            // Deploy V1 with an initial greeting.
            const deployed = await hre.contractDeployment.deployContract(
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

            // Upgrade to V2 in-place. The plugin's upgrade API uses
            // `contractName` for both the factory lookup AND the address-book
            // lookup, so V1→V2 means registering a V2 entry pointing at the
            // existing V1 proxy address first.
            book.saveContract('GreeterV2', proxyAddress, network.name, '')

            const upgraded = await hre.contractDeployment.upgradeContract(
                'GreeterV2',
                undefined,
                undefined,
                true, // skipGit
                false // verifyContract
            )
            assert.equal(upgraded.success, true)
            assert.equal(upgraded.proxyAddress, proxyAddress, 'proxy address should be unchanged')

            // Re-attach to the proxy using V2's ABI.
            const GreeterV2 = await ethers.getContractFactory('GreeterV2')
            const proxied = GreeterV2.attach(proxyAddress)

            // Storage preserved through the upgrade.
            assert.equal(await proxied.greeting(), 'original')
            // New V2-only function is reachable.
            assert.equal(await proxied.version(), 'V2')
            await proxied.setGreeting('updated')
            assert.equal(await proxied.greeting(), 'updated')
        })

        it('returns failure when the proxy is not in the address book', async function () {
            // No prior deploy — address book is empty.
            const upgraded = await hre.contractDeployment.upgradeContract(
                'GreeterV1',
                undefined,
                undefined,
                true,
                false
            )
            assert.equal(upgraded.success, false)
            assert.match(upgraded.message, /Upgrade failed/)
        })
    })

    describe('testDeployThenUpgradeContract', function () {
        it('deploys then performs a same-name upgrade round-trip', async function () {
            const result = await hre.contractDeployment.testDeployThenUpgradeContract(
                'GreeterV1',
                ['start'],
                'initialize',
                undefined,
                undefined,
                true,
                false
            )

            // The API uses the same `contractName` for the deploy and upgrade
            // steps, so the implementation stays at V1 — the round-trip
            // verifies the address and storage survive the second deploy.
            assert.equal(result.success, true, 'final upgrade should succeed')
            assert.equal(result.contractName, 'GreeterV1')
            assert.ok(result.proxyAddress, 'proxyAddress should be returned')
            assert.equal(await result.contract.version(), 'V1')
            assert.equal(await result.contract.greeting(), 'start')
        })
    })

    describe('deployContractStatic', function () {
        it('deploys a non-upgradeable contract with constructor arguments', async function () {
            const result = await hre.contractDeployment.deployContractStatic(
                'StaticBox',
                ['my-label'],
                undefined,
                undefined,
                true,
                false
            )

            assert.equal(result.success, true)
            assert.equal(result.contractName, 'StaticBox')
            assert.ok(result.address, 'address should be returned')
            assert.equal(result.address, result.contract.address)

            // Attach a fresh instance to read the public state.
            const StaticBox = await ethers.getContractFactory('StaticBox')
            const onChain = StaticBox.attach(result.address!)
            assert.equal(await onChain.label(), 'my-label')
        })
    })
})