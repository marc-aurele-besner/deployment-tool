#!/usr/bin/env node

import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
import 'hardhat-awesome-cli'
import { extendConfig, extendEnvironment, task } from 'hardhat/config'
import { lazyObject } from 'hardhat/plugins'
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types'
import path from 'path'

import { ContractDeployment } from './ContractDeployment'
import serveTasks from './serveTasks'
import './type-extensions'

extendConfig(async (config: HardhatConfig, userConfig: HardhatUserConfig) => {
    const userPath = userConfig.paths?.deployment
    let deployment: string
    if (userPath === undefined) deployment = path.join(config.paths.root, 'deployment')
    else {
        if (path.isAbsolute(userPath)) deployment = userPath
        else deployment = path.normalize(path.join(config.paths.root, userPath))
    }
    config.paths.deployment = deployment
})

extendEnvironment(async (hre: any) => {
    hre.contractDeployment = lazyObject(() => new ContractDeployment(hre))
})

/**
 * deployment task implementation
 * @param  {HardhatUserArgs} args
 * @param  {HardhatEnv} env
 */
task('deployment', 'Deploy or Update a proxy contract').setAction(async function (args, env) {
    // Call function
    await serveTasks('', args, env)
})

/**
 * deploy-contract task implementation
 * @param  {HardhatUserArgs} args
 * @param  {HardhatEnv} env
 */
task('deploy-contract', 'Deploy a proxy contract, initialize it, save the address, commit, pull and push')
    .addOptionalParam('contractName', 'The name of the contract to deploy', '')
    .addOptionalParam('initializeArguments', 'The initialize() argument', '')
    .addOptionalParam('initializeSignature', 'Function signature of the initialize function', '')
    .addOptionalParam('tag', 'Add a extra tag to this version of the contract', '')
    .addOptionalParam('extra', 'Extra data to save with this deployment', '')
    .addOptionalParam('skipGit', 'Skit git commit, pull & push', 'false')
    .addOptionalParam('verifyContract', 'Validate the contract on Etherscan.io', 'false')
    .setAction(async function (args, env) {
        // Call function
        await serveTasks('deploy-contract', args, env)
    })

/**
 * upgrade-contract task implementation
 * @param  {HardhatUserArgs} args
 * @param  {HardhatEnv} env
 */
task('upgrade-contract', 'Upgrade a proxy contract, save the address, commit, pull and push')
    .addOptionalParam('contractName', 'The name of the contract to deploy', '')
    .addOptionalParam('tag', 'Add a extra tag to this version of the contract', '')
    .addOptionalParam('extra', 'Extra data to save with this deployment', '')
    .addOptionalParam('skipGit', 'Skit git commit, pull & push', 'false')
    .addOptionalParam('verifyContract', 'Validate the contract on Etherscan.io', 'false')
    .setAction(async function (args, env) {
        // Call function
        await serveTasks('upgrade-contract', args, env)
    })

/**
 * deploy-contract-static task implementation
 * @param  {HardhatUserArgs} args
 * @param  {HardhatEnv} env
 */
task('deploy-contract-static', 'Deploy a static contract, save the address, commit, pull and push')
    .addOptionalParam('contractName', 'The name of the contract to deploy', '')
    .addOptionalParam('constructorArguments', 'The constructor() argument', '')
    .addOptionalParam('tag', 'Add a extra tag to this version of the contract', '')
    .addOptionalParam('extra', 'Extra data to save with this deployment', '')
    .addOptionalParam('skipGit', 'Skit git commit, pull & push', 'false')
    .addOptionalParam('verifyContract', 'Validate the contract on Etherscan.io', 'false')
    .setAction(async function (args, env) {
        // Call function
        await serveTasks('deploy-contract-static', args, env)
    })

/**
 * test-deploy-then-upgrade-contract task implementation
 * @param  {HardhatUserArgs} args
 * @param  {HardhatEnv} env
 */
task('test-deploy-then-upgrade-contract', 'Upgrade a proxy contract, save the address, commit, pull and push')
    .addParam('contractName', 'The name of the contract to deploy', '')
    .addOptionalParam('initializeArguments', 'The initialize() argument', '')
    .addOptionalParam('initializeSignature', 'Function signature of the initialize function', '')
    .addOptionalParam('tag', 'Add a extra tag to this version of the contract', '')
    .addOptionalParam('extra', 'Extra data to save with this deployment', '')
    .addOptionalParam('skipGit', 'Skit git commit, pull & push', 'false')
    .addOptionalParam('verifyContract', 'Validate the contract on Etherscan.io', 'false')
    .setAction(async function (args, env) {
        // Call function
        await serveTasks('test-deploy-then-upgrade-contract', args, env)
    })
