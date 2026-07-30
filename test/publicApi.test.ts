import { strict as assert } from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import deploymentToolPluginDefault, {
    ContractDeployment,
    createContractDeployment,
    resolveUserConfig
} from '../src/index.js'

/**
 * Public-API surface tests (issue #104).
 *
 * `package.json` now resolves `"deployment-tool"` to `dist/index.js`, which
 * is the compiled form of this same `src/index.ts` — so verifying the
 * re-exports at the source level covers what consumers see. We also pin the
 * `package.json` `exports` shape so a future rename can't silently break
 * resolution. The other test files import from `src/` rather than `dist/`
 * to stay build-independent in CI (Hardhat's `tsx` resolves both `.js` and
 * `.ts` here).
 */
type PackageJson = {
    name?: string
    main?: string
    typings?: string
    exports?: Record<string, unknown>
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as PackageJson

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

    it('package.json resolves "." to dist/index.js with matching types', () => {
        const rootExport = packageJson.exports?.['.']
        assert.ok(rootExport, 'package.json is missing an "exports" map for "."')

        // The map may be a plain string, an object, or a conditional object.
        const resolveObject = (value: unknown): Record<string, string> | undefined => {
            if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, string>
            return undefined
        }

        const entry = resolveObject(rootExport)
        assert.ok(entry, '`exports["."]` should be an object so we can declare types/import')

        assert.equal(entry.import, './dist/index.js')
        assert.equal(entry.types, './dist/index.d.ts')
        assert.equal(packageJson.main, './dist/index.js')
        assert.equal(packageJson.typings, './dist/index.d.ts')
    })
})
