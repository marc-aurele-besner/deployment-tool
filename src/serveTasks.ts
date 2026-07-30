import inquirer from 'inquirer'

import type { ContractDeployment } from './ContractDeployment.js'

/**
 * Parse a CLI option value (typically a string from `--skip-git false`) into
 * a strict boolean. Accepts only 'true' / 'false' (case-insensitive, trimmed);
 * anything else — including the empty default `''` from `addOption` and
 * `undefined` when the option is omitted — resolves to `undefined` so the
 * caller can fall back to a sensible downstream default.
 *
 * Replaces the previous `value && value === 'true' ? true : !!value` trick,
 * which incorrectly mapped the literal string 'false' to `true` because
 * `!!'false'` is `true` (issue #94).
 */
export const parseBooleanArg = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value
    if (value === undefined || value === null) return undefined
    const normalized = String(value).trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
    return undefined
}

const inquirerContractNameInput = [
    {
        type: 'input',
        name: 'contractName',
        message: 'What is the name of the contract to deploy?'
    }
]
const inquirerInitializer = [
    {
        type: 'input',
        name: 'initializeSignature',
        message: 'What is the function signature of the initialize function? (optional)',
        default: 'initialize'
    },
    {
        type: 'input',
        name: 'initializeArguments',
        message: 'What is the initialize() argument? (separate multiple arguments with a comma)'
    }
]
const inquirerConstructor = [
    {
        type: 'input',
        name: 'constructorArguments',
        message: 'What is the constructor() argument?'
    }
]
const inquirerExtra = [
    {
        type: 'input',
        name: 'tag',
        message: 'What is the tag for this version of the contract? (optional)'
    },
    {
        type: 'input',
        name: 'extra',
        message: 'What is the extra data to save with this deployment? (optional)'
    },
    {
        type: 'confirm',
        name: 'skipGit',
        message: 'Do you want to SKIP the commit, pull & push to Github?'
    },
    {
        type: 'confirm',
        name: 'verifyContract',
        message: 'Do you want to verify the contract on Etherscan.io?'
    }
]

const runDeployProxy = async (cd: ContractDeployment, args: any) => {
    const initializeSignature = args.initializeSignature ? args.initializeSignature : 'initialize'
    const initializeArguments = args.initializeArguments ? args.initializeArguments.split(',') : []
    await cd.deployContract(
        args.contractName,
        initializeArguments,
        initializeSignature,
        args.tag,
        args.extra,
        parseBooleanArg(args.skipGit) ?? false,
        parseBooleanArg(args.verifyContract) ?? false
    )
}

const runUpgradeProxy = async (cd: ContractDeployment, args: any) => {
    await cd.upgradeContract(
        args.contractName,
        args.tag,
        args.extra,
        parseBooleanArg(args.skipGit) ?? false,
        parseBooleanArg(args.verifyContract) ?? false
    )
}

const runDeployStatic = async (cd: ContractDeployment, args: any) => {
    const constructorArguments = args.constructorArguments ? args.constructorArguments.split(',') : []
    await cd.deployContractStatic(
        args.contractName,
        constructorArguments,
        args.tag,
        args.extra,
        parseBooleanArg(args.skipGit) ?? false,
        parseBooleanArg(args.verifyContract) ?? false
    )
}

const serveDeployTask = async (args: any, cd: ContractDeployment) => {
    if (!args.contractName || args.contractName === '')
        await inquirer
            .prompt([...inquirerContractNameInput, ...inquirerInitializer, ...inquirerExtra])
            .then(async (answers) => runDeployProxy(cd, answers))
            .catch((err: any) => {
                console.log(err)
            })
            .finally(() => process.exit(0))
    else await runDeployProxy(cd, args)
}

const serveUpgradeTask = async (args: any, cd: ContractDeployment) => {
    if (!args.contractName || args.contractName === '')
        await inquirer
            .prompt([...inquirerContractNameInput, ...inquirerExtra])
            .then(async (answers) => runUpgradeProxy(cd, answers))
            .catch((err: any) => {
                console.log(err)
            })
            .finally(() => process.exit(0))
    else await runUpgradeProxy(cd, args)
}

const serveDeployStaticTask = async (args: any, cd: ContractDeployment) => {
    if (!args.contractName || args.contractName === '')
        await inquirer
            .prompt([...inquirerContractNameInput, ...inquirerConstructor, ...inquirerExtra])
            .then(async (answers) => runDeployStatic(cd, answers))
            .catch((err: any) => {
                console.log(err)
            })
            .finally(() => process.exit(0))
    else await runDeployStatic(cd, args)
}

const serveTestTask = async (args: any, cd: ContractDeployment) => {
    if (!args.contractName || args.contractName === '')
        await inquirer
            .prompt([...inquirerContractNameInput, ...inquirerInitializer, ...inquirerExtra])
            .then(async (answers) => {
                await runDeployProxy(cd, answers)
                await runUpgradeProxy(cd, answers)
            })
            .catch((err: any) => {
                console.log(err)
            })
            .finally(() => process.exit(0))
    else {
        await runDeployProxy(cd, args)
        await runUpgradeProxy(cd, args)
    }
}

const serveCLI = async (task: string) => {
    if (task === '')
        return (
            await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'What do you want to do?',
                    choices: ['deploy-contract', 'upgrade-contract', 'test-deploy-then-upgrade-contract']
                }
            ])
        ).action
    else return task
}

const serveFunction = async (task: string, args: any, cd: ContractDeployment) => {
    const action = await serveCLI(task)
    if (action === 'deploy-contract') await serveDeployTask(args, cd)
    if (action === 'upgrade-contract') await serveUpgradeTask(args, cd)
    if (action === 'deploy-contract-static') await serveDeployStaticTask(args, cd)
    if (action === 'test-deploy-then-upgrade-contract') await serveTestTask(args, cd)
}

const serveTasks = async (task: string, args: any, cd: ContractDeployment) => {
    console.log(`Deployment tools for Gluwa\n`)
    return serveFunction(task, args, cd)
}

export default serveTasks
