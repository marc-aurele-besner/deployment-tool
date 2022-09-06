import inquirer from 'inquirer'

import deployProxy from './deployProxy'
import upgradeProxy from './upgradeProxy'

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
const serveDeployTask = async (args: any, env: any) => {
    if (!args.contractName || args.contractName === '')
        await inquirer
            .prompt([...inquirerContractNameInput, ...inquirerInitializer, ...inquirerExtra])
            .then(
                async (answers: {
                    contractName: string
                    initializeSignature: string
                    initializeArguments: string
                    tag: string
                    extra: string
                    skipGit: boolean
                    verifyContract: boolean
                }) => {
                    const initializeArguments = answers.initializeArguments
                        ? answers.initializeArguments.split(',')
                        : []
                    await deployProxy(
                        env,
                        answers.contractName,
                        initializeArguments,
                        answers.initializeSignature,
                        answers.tag,
                        answers.extra,
                        answers.skipGit,
                        answers.verifyContract
                    )
                }
            )
            .catch((err: any) => {
                console.log(err)
            })
            .finally(() => {
                process.exit(0)
            })
    else {
        const initializeSignature = args.initializeSignature ? args.initializeSignature : 'initialize'
        const initializeArguments = args.initializeArguments ? args.initializeArguments.split(',') : []
        await deployProxy(
            env,
            args.contractName,
            initializeArguments,
            initializeSignature,
            args.tag,
            args.extra,
            args.skipGit && args.skipGit === 'true' ? true : false,
            args.verifyContract && args.verifyContract === 'true' ? true : false
        )
    }
}

const serveUpgradeTask = async (args: any, env: any) => {
    if (!args.contractName || args.contractName === '')
        await inquirer
            .prompt([...inquirerContractNameInput, ...inquirerExtra])
            .then(
                async (answers: {
                    contractName: string
                    tag: string
                    extra: string
                    skipGit: boolean
                    verifyContract: boolean
                }) => {
                    await upgradeProxy(
                        env,
                        answers.contractName,
                        answers.tag,
                        answers.extra,
                        answers.skipGit,
                        answers.verifyContract
                    )
                }
            )
            .catch((err: any) => {
                console.log(err)
            })
            .finally(() => {
                process.exit(0)
            })
    else {
        await upgradeProxy(
            env,
            args.contractName,
            args.tag,
            args.extra,
            args.skipGit && args.skipGit === 'true' ? true : false,
            args.verifyContract && args.verifyContract === 'true' ? true : false
        )
    }
}

const serveTestTask = async (args: any, env: any) => {
    if (!args.contractName || args.contractName === '')
        await inquirer
            .prompt([...inquirerContractNameInput, ...inquirerInitializer, ...inquirerExtra])
            .then(
                async (answers: {
                    contractName: string
                    initializeSignature: string
                    initializeArguments: string
                    tag: string
                    extra: string
                    skipGit: boolean
                    verifyContract: boolean
                }) => {
                    const initializeArguments = answers.initializeArguments
                        ? answers.initializeArguments.split(',')
                        : []
                    await deployProxy(
                        env,
                        answers.contractName,
                        initializeArguments,
                        answers.initializeSignature,
                        answers.tag,
                        answers.extra,
                        answers.skipGit,
                        answers.verifyContract
                    )
                    await upgradeProxy(
                        env,
                        answers.contractName,
                        answers.tag,
                        answers.extra,
                        answers.skipGit,
                        answers.verifyContract
                    )
                }
            )
            .catch((err: any) => {
                console.log(err)
            })
            .finally(() => {
                process.exit(0)
            })
    else {
        const initializeSignature = args.initializeSignature ? args.initializeSignature : 'initialize'
        const initializeArguments = args.initializeArguments ? args.initializeArguments.split(',') : []
        await deployProxy(
            env,
            args.contractName,
            initializeArguments,
            initializeSignature,
            args.tag,
            args.extra,
            args.skipGit && args.skipGit === 'true' ? true : false,
            args.verifyContract && args.verifyContract === 'true' ? true : false
        )
        await upgradeProxy(
            env,
            args.contractName,
            args.tag,
            args.extra,
            args.skipGit && args.skipGit === 'true' ? true : false,
            args.verifyContract && args.verifyContract === 'true' ? true : false
        )
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

const serveFunction = async (task: string, args: any, env: any) => {
    const action = await serveCLI(task)
    if (action === 'deploy-contract') await serveDeployTask(args, env)
    if (action === 'upgrade-contract') await serveUpgradeTask(args, env)
    if (action === 'test-deploy-then-upgrade-contract') await serveTestTask(args, env)
}

const serveTasks = async (task: string, args: any, env: any) => {
    console.log(`Deployment tools for Gluwa
`)
    return serveFunction(task, args, env)
}

export default serveTasks
