import { strict as assert } from 'assert'

import deploymentToolPluginDefault, { ContractDeployment, createContractDeployment, resolveUserConfig } from '../dist/index.js'

/**
 * Public-API surface tests (issue #104).
 *
 * The package's `exports` map resolves `"deployment-tool"` to
 * `dist/index.js`, so these assertions verify exactly what consumers
 * see — the default Hardhat plugin plus the named programmatic
 * helpers. Before the fix, `ContractDeployment` / `createContractDeployment`
 * were only reachable via a deep import into `dist/lib.js`.
 */
describe('public API (issue #104)', () => {
    it('default export is the Hardhat plugin', () => {
        assert.equal(typeof deploymentToolPluginDefault, 'object')
        assert.ok(deploymentToolPluginDefault !== null)
        assert.equal((deploymentToolPluginDefault as { id: string }).id, 'deployment-tool')
    })

    it('re-exports ContractDeployment as a constructable class', () => {
        assert.equal(typeof ContractDeployment, 'function')
        // Smoke-check the prototype without touching hre: an instance shape
        // should expose `deployContract` and `upgradeContract`.
        assert.equal(typeof ContractDeployment.prototype.deployContract, 'function')
        assert.equal(typeof ContractDeployment.prototype.upgradeContract, 'function')
    })

    it('re-exports createContractDeployment as a function', () => {
        assert.equal(typeof createContractDeployment, 'function')
    })

    it('still re-exports resolveUserConfig for the config hook chain', () => {
        assert.equal(typeof resolveUserConfig, 'function')
    })
})
