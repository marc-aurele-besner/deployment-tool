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

/**
 * Parse a CLI option value (typically `--initialize-arguments` or
 * `--constructor-arguments`) into a typed `unknown[]` to forward to
 * `deployContract` / `deployContractStatic`.
 *
 * Three input shapes are supported, picked by inspection:
 *
 * 1. Empty input — `undefined`, `null`, `''`, or whitespace-only — yields
 *    `[]`. This matches the empty default emitted by Hardhat's `addOption`
 *    and the current `args.x ? args.x.split(',') : []` behavior at the
 *    call sites.
 * 2. JSON input — a string whose first non-whitespace character is `[`
 *    or `{` — is parsed via `JSON.parse` and returned. Arrays pass
 *    through; a single object is wrapped in a one-element array so the
 *    downstream `any[]` contract is always honored. Malformed JSON
 *    throws a clear error that includes the offending input (issue #100).
 * 3. Plain string input — anything else — keeps the legacy comma-split
 *    so existing invocations such as `'Alice,Bob'` continue to work.
 *
 * Already-parsed values (programmatic invocation) are also accepted:
 * arrays pass through, other primitives are wrapped in a one-element
 * array, objects are wrapped in a one-element array.
 */
export const parseArgumentsArg = (value: unknown): unknown[] => {
    if (value === undefined || value === null) return []
    if (Array.isArray(value)) return value
    if (typeof value === 'object') return [value]
    if (typeof value !== 'string') return [value]

    const trimmed = value.trim()
    if (trimmed === '') return []

    const first = trimmed[0]
    if (first === '[' || first === '{') {
        try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) return parsed
            return [parsed]
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err)
            throw new Error(
                `Failed to parse arguments as JSON: ${reason}. ` +
                    `Pass a JSON array (e.g. '["hello", 1, true]') or a JSON object ` +
                    `wrapped in an array, or fall back to a plain comma-separated ` +
                    `string list. Received: ${JSON.stringify(value)}`
            )
        }
    }

    return trimmed.split(',')
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
        message:
            'What is the initialize() argument? ' +
            '(JSON array like \'["hello", 1, true]\' for typed values, or comma-separated strings)'
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
    const initializeArguments = parseArgumentsArg(args.initializeArguments)
    await cd.deployContract(
        args.contractName,
        initializeArguments,
        initializeSignature,
        args.tag,
        args.extra,
        parseBooleanArg(args.skipGit) ?? false,
        // Forward `undefined` when the flag is omitted so the underlying
        // `deployProxy` default (`verifyContractFlag = true`) applies; the
        // previous `?? false` masked the default and silently disabled
        // verification on CLI/invocations without `--verify-contract`
        // (issue #97).
        parseBooleanArg(args.verifyContract)
    )
}

const runUpgradeProxy = async (cd: ContractDeployment, args: any) => {
    await cd.upgradeContract(
        args.contractName,
        args.tag,
        args.extra,
        parseBooleanArg(args.skipGit) ?? false,
        // Forward `undefined` when the flag is omitted so the underlying
        // `upgradeProxy` default (`verifyContractFlag = true`) applies; the
        // previous `?? false` masked the default and silently disabled
        // verification on CLI/invocations without `--verify-contract`
        // (issue #97).
        parseBooleanArg(args.verifyContract)
    )
}

const runDeployStatic = async (cd: ContractDeployment, args: any) => {
    const constructorArguments = parseArgumentsArg(args.constructorArguments)
    await cd.deployContractStatic(
        args.contractName,
        constructorArguments,
        args.tag,
        args.extra,
        parseBooleanArg(args.skipGit) ?? false,
        parseBooleanArg(args.verifyContract)
    )
}

/**
 * When the `deployment` task is invoked without `--contract-name`, no args
 * reach us from Hardhat at all (see `src/tasks/deployment.ts`). When the
 * dedicated task runners are invoked without `--contract-name`, args is a
 * Hardhat task-args object whose `contractName` is the empty-string default.
 * Either way, an empty/missing contract name means "ask the user".
 */
const needsInteractivePrompt = (args: any): boolean =>
    !args || args.contractName === undefined || args.contractName === ''

/**
 * Run a task either from the provided args or — when `--contract-name` is
 * missing — by collecting the same fields via an inquirer prompt. The
 * prompt path owns its own process lifetime: it exits 0 on success and 1
 * when the underlying action threw, so shell pipelines and CI see real
 * failures instead of silently succeeding on error (issue #101).
 *
 * When args ARE provided, we deliberately do NOT call `process.exit`,
 * letting Hardhat decide the exit code based on whether the action
 * resolved or rejected.
 *
 * Exported for testing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const runInteractive = async (
    args: any,
    prompts: any[],
    run: (answers: any) => Promise<void>
): Promise<void> => {
    if (!needsInteractivePrompt(args)) {
        await run(args)
        return
    }
    let hadError = false
    await inquirer
        .prompt(prompts)
        .then(async (answers) => run(answers))
        .catch((err: any) => {
            hadError = true
            console.log(err)
        })
        .finally(() => process.exit(hadError ? 1 : 0))
}

const serveDeployTask = async (args: any, cd: ContractDeployment) => {
    await runInteractive(args, [...inquirerContractNameInput, ...inquirerInitializer, ...inquirerExtra], (answers) =>
        runDeployProxy(cd, answers)
    )
}

const serveUpgradeTask = async (args: any, cd: ContractDeployment) => {
    await runInteractive(args, [...inquirerContractNameInput, ...inquirerExtra], (answers) =>
        runUpgradeProxy(cd, answers)
    )
}

const serveDeployStaticTask = async (args: any, cd: ContractDeployment) => {
    await runInteractive(args, [...inquirerContractNameInput, ...inquirerConstructor, ...inquirerExtra], (answers) =>
        runDeployStatic(cd, answers)
    )
}

const serveTestTask = async (args: any, cd: ContractDeployment) => {
    await runInteractive(
        args,
        [...inquirerContractNameInput, ...inquirerInitializer, ...inquirerExtra],
        async (answers) => {
            await runDeployProxy(cd, answers)
            await runUpgradeProxy(cd, answers)
        }
    )
}

/**
 * Tasks surfaced by the interactive menu when the `deployment` task runs
 * with no CLI args. Kept in sync with the dispatch table in
 * {@link serveFunction} and the task registry in `src/index.ts`. Exported
 * so tests can assert the menu stays complete (issue #101, which
 * originally omitted `deploy-contract-static`).
 */
export const INTERACTIVE_CHOICES = [
    'deploy-contract',
    'upgrade-contract',
    'deploy-contract-static',
    'test-deploy-then-upgrade-contract'
] as const

const serveCLI = async (task: string) => {
    if (task === '')
        return (
            await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'What do you want to do?',
                    choices: [...INTERACTIVE_CHOICES]
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

/**
 * Banner printed when an interactive prompt is about to run. Matches the
 * published package name `deployment-tool` (issue #101).
 */
export const INTERACTIVE_BANNER = 'Deployment tools for deployment-tool'

const serveTasks = async (task: string, args: any, cd: ContractDeployment) => {
    console.log(`${INTERACTIVE_BANNER}\n`)
    return serveFunction(task, args, cd)
}

export default serveTasks
