import type { ConfigurationVariableResolver, HardhatConfig, HardhatUserConfig } from 'hardhat/types/config'
import type { HardhatPlugin } from 'hardhat/types/plugins'
import path from 'path'

import { definePlugin } from 'hardhat/plugins'
import { task } from 'hardhat/config'

import './type-extensions.js'

export { ContractDeployment, createContractDeployment } from './lib.js'

/**
 * Hardhat 3 config hook that resolves `paths.deployment` from the user
 * config into the resolved config. This replaces the `extendConfig`
 * callback the Hardhat 2 plugin used.
 */
async function resolveUserConfig(
    userConfig: HardhatUserConfig,
    _resolveConfigurationVariable: ConfigurationVariableResolver,
    next: (
        nextUserConfig: HardhatUserConfig,
        nextResolveConfigurationVariable: ConfigurationVariableResolver
    ) => Promise<HardhatConfig>
): Promise<HardhatConfig> {
    const config = await next(userConfig, _resolveConfigurationVariable)
    const userPath = (userConfig.paths as { deployment?: string } | undefined)?.deployment
    let deployment: string
    if (userPath === undefined) deployment = path.join(config.paths.root, 'deployment')
    else if (path.isAbsolute(userPath)) deployment = userPath
    else deployment = path.normalize(path.join(config.paths.root, userPath))
    config.paths.deployment = deployment
    return config
}

function configHookHandlerFactory() {
    return import('./hooks.js').then((mod) => ({ default: mod.default }))
}

// --- Tasks ---
//
// Each task's action is loaded lazily so plugin code can stay load-order safe.

const deploymentTask = task('deployment', 'Deploy or update a proxy contract')
    .setAction(() => import('./tasks/deployment.js'))
    .build()

const deployContractTask = task(
    'deploy-contract',
    'Deploy a proxy contract, initialize it, save the address, commit, pull and push'
)
    .addOption({ name: 'contractName', description: 'The name of the contract to deploy', defaultValue: '' })
    .addOption({ name: 'initializeArguments', description: 'The initialize() argument', defaultValue: '' })
    .addOption({
        name: 'initializeSignature',
        description: 'Function signature of the initialize function',
        defaultValue: ''
    })
    .addOption({ name: 'tag', description: 'Add an extra tag to this version of the contract', defaultValue: '' })
    .addOption({ name: 'extra', description: 'Extra data to save with this deployment', defaultValue: '' })
    .addOption({ name: 'skipGit', description: 'Skip git commit, pull & push', defaultValue: '' })
    .addOption({ name: 'verifyContract', description: 'Validate the contract on Etherscan.io', defaultValue: '' })
    .setAction(() => import('./tasks/deploy-contract.js'))
    .build()

const upgradeContractTask = task(
    'upgrade-contract',
    'Upgrade a proxy contract, save the address, commit, pull and push'
)
    .addOption({ name: 'contractName', description: 'The name of the contract to deploy', defaultValue: '' })
    .addOption({ name: 'tag', description: 'Add an extra tag to this version of the contract', defaultValue: '' })
    .addOption({ name: 'extra', description: 'Extra data to save with this deployment', defaultValue: '' })
    .addOption({ name: 'skipGit', description: 'Skip git commit, pull & push', defaultValue: '' })
    .addOption({ name: 'verifyContract', description: 'Validate the contract on Etherscan.io', defaultValue: '' })
    .setAction(() => import('./tasks/upgrade-contract.js'))
    .build()

const deployContractStaticTask = task(
    'deploy-contract-static',
    'Deploy a static contract, save the address, commit, pull and push'
)
    .addOption({ name: 'contractName', description: 'The name of the contract to deploy', defaultValue: '' })
    .addOption({ name: 'constructorArguments', description: 'The constructor() argument', defaultValue: '' })
    .addOption({ name: 'tag', description: 'Add an extra tag to this version of the contract', defaultValue: '' })
    .addOption({ name: 'extra', description: 'Extra data to save with this deployment', defaultValue: '' })
    .addOption({ name: 'skipGit', description: 'Skip git commit, pull & push', defaultValue: '' })
    .addOption({ name: 'verifyContract', description: 'Validate the contract on Etherscan.io', defaultValue: '' })
    .setAction(() => import('./tasks/deploy-contract-static.js'))
    .build()

const testDeployThenUpgradeTask = task(
    'test-deploy-then-upgrade-contract',
    'Upgrade a proxy contract, save the address, commit, pull and push'
)
    .addOption({ name: 'contractName', description: 'The name of the contract to deploy', defaultValue: '' })
    .addOption({ name: 'initializeArguments', description: 'The initialize() argument', defaultValue: '' })
    .addOption({
        name: 'initializeSignature',
        description: 'Function signature of the initialize function',
        defaultValue: ''
    })
    .addOption({ name: 'tag', description: 'Add an extra tag to this version of the contract', defaultValue: '' })
    .addOption({ name: 'extra', description: 'Extra data to save with this deployment', defaultValue: '' })
    .addOption({ name: 'skipGit', description: 'Skip git commit, pull & push', defaultValue: '' })
    .addOption({ name: 'verifyContract', description: 'Validate the contract on Etherscan.io', defaultValue: '' })
    .setAction(() => import('./tasks/test-deploy-then-upgrade-contract.js'))
    .build()

const deploymentToolPlugin: HardhatPlugin = definePlugin({
    id: 'deployment-tool',
    npmPackage: 'deployment-tool',
    tasks: [
        deploymentTask,
        deployContractTask,
        upgradeContractTask,
        deployContractStaticTask,
        testDeployThenUpgradeTask
    ],
    hookHandlers: {
        config: configHookHandlerFactory
    }
})

export default deploymentToolPlugin

export { resolveUserConfig }
