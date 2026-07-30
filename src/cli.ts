#!/usr/bin/env node

import { spawnSync } from 'child_process'
import { createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import path from 'path'

/**
 * Standalone `deployment-tool` binary.
 *
 * The package is a Hardhat 3 plugin: its real entry point is `src/index.ts`,
 * a `definePlugin(...)` module that Hardhat loads from `hardhat.config.ts`.
 * `package.json` used to point `bin` straight at that module, so running
 * `deployment-tool` executed a plugin definition and exited silently —
 * broken and misleading for end users (issue #102).
 *
 * This file is the real CLI. It never imports Hardhat, so `--help` and
 * `--version` work from any directory, including one with no Hardhat
 * project. Task invocations are delegated to the project's own Hardhat via
 * `npx hardhat <task> …`.
 */

/** A task contributed by the plugin, mirrored from `src/index.ts`. */
export interface CliTask {
    name: string
    description: string
}

/**
 * Tasks exposed by the plugin, kept in sync with the `tasks` array in
 * `src/index.ts`. The list is duplicated deliberately: importing the plugin
 * would pull Hardhat into the CLI's startup path and make `--help` fail
 * outside a Hardhat project. `test/cli.test.ts` asserts the two lists match,
 * so drift is a test failure rather than a silent inconsistency.
 */
export const TASKS: readonly CliTask[] = [
    { name: 'deployment', description: 'Deploy or update a proxy contract' },
    {
        name: 'deploy-contract',
        description: 'Deploy a proxy contract, initialize it, save the address, commit, pull and push'
    },
    {
        name: 'upgrade-contract',
        description: 'Upgrade a proxy contract, save the address, commit, pull and push'
    },
    {
        name: 'deploy-contract-static',
        description: 'Deploy a static contract, save the address, commit, pull and push'
    },
    {
        name: 'test-deploy-then-upgrade-contract',
        description: 'Upgrade a proxy contract, save the address, commit, pull and push'
    }
]

/** What {@link parseCliArgs} decided the user asked for. */
export type CliPlan =
    | { kind: 'help' }
    | { kind: 'version' }
    | { kind: 'delegate'; task: string; args: string[] }
    | { kind: 'unknown'; command: string }

const HELP_FLAGS = new Set(['-h', '--help', 'help'])
const VERSION_FLAGS = new Set(['-v', '--version', 'version'])

/**
 * Map raw `process.argv.slice(2)` onto a {@link CliPlan}. Pure — it performs
 * no I/O — so the dispatch table is unit-testable without spawning Hardhat.
 */
export const parseCliArgs = (argv: readonly string[]): CliPlan => {
    const [first, ...rest] = argv
    if (first === undefined || first.trim() === '') return { kind: 'help' }
    if (HELP_FLAGS.has(first)) return { kind: 'help' }
    if (VERSION_FLAGS.has(first)) return { kind: 'version' }
    if (TASKS.some((t) => t.name === first)) return { kind: 'delegate', task: first, args: rest }
    return { kind: 'unknown', command: first }
}

/**
 * Read the package version from the published `package.json`, which sits one
 * directory above both `src/` (dev) and `dist/` (published). Falls back to
 * `'unknown'` rather than throwing, so `--version` can never crash the CLI.
 */
export const readVersion = (): string => {
    try {
        const require = createRequire(import.meta.url)
        const here = path.dirname(fileURLToPath(import.meta.url))
        const pkg = require(path.join(here, '..', 'package.json')) as { version?: string }
        return pkg.version ?? 'unknown'
    } catch {
        return 'unknown'
    }
}

/** The usage text printed for `--help`, a bare invocation, or a bad command. */
export const formatUsage = (version: string = readVersion()): string => {
    const width = Math.max(...TASKS.map((t) => t.name.length))
    const taskLines = TASKS.map((t) => `  ${t.name.padEnd(width)}  ${t.description}`).join('\n')
    return [
        `deployment-tool ${version} — Hardhat 3 plugin`,
        '',
        'This package is a Hardhat plugin. Add it to the `plugins` array in your',
        'hardhat.config.ts, then run its tasks through Hardhat:',
        '',
        '  npx hardhat deploy-contract --contract-name MyContract',
        '',
        'USAGE',
        '  deployment-tool <task> [options]   delegate to `npx hardhat <task>`',
        '  deployment-tool --help',
        '  deployment-tool --version',
        '',
        'TASKS',
        taskLines,
        '',
        "Run `deployment-tool <task> --help` to see a task's options.",
        'Docs: https://github.com/marc-aurele-besner/deployment-tool'
    ].join('\n')
}

/** Injectable side effects, so tests can drive {@link runCli} without I/O. */
export interface CliIo {
    stdout: (line: string) => void
    stderr: (line: string) => void
    delegate: (task: string, args: string[]) => number
}

/**
 * Hand a task off to the project's Hardhat. `npx` resolves the locally
 * installed `hardhat` binary, which is where the plugin — and the user's
 * config, networks and keystore — actually live.
 */
const spawnHardhat = (task: string, args: string[]): number => {
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const result = spawnSync(command, ['hardhat', task, ...args], { stdio: 'inherit' })
    if (result.error !== undefined) {
        process.stderr.write(
            `deployment-tool: failed to run \`npx hardhat ${task}\`: ${result.error.message}\n` +
                'Is Hardhat installed in this project?\n'
        )
        return 1
    }
    // A process killed by a signal reports `status === null`; treat it as failure.
    return result.status ?? 1
}

const defaultIo: CliIo = {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
    delegate: spawnHardhat
}

/** Execute a parsed plan and return the process exit code. */
export const runCli = (argv: readonly string[], io: CliIo = defaultIo): number => {
    const plan = parseCliArgs(argv)
    switch (plan.kind) {
        case 'help':
            io.stdout(formatUsage())
            return 0
        case 'version':
            io.stdout(readVersion())
            return 0
        case 'delegate':
            return io.delegate(plan.task, plan.args)
        case 'unknown':
            io.stderr(`deployment-tool: unknown command '${plan.command}'\n`)
            io.stderr(formatUsage())
            return 1
    }
}

/**
 * Only run when invoked as a binary — importing this module from a test must
 * not spawn Hardhat or exit the process.
 */
const isMain = (): boolean => {
    const entry = process.argv[1]
    if (entry === undefined) return false
    try {
        return pathToFileURL(entry).href === import.meta.url
    } catch {
        return false
    }
}

if (isMain()) process.exitCode = runCli(process.argv.slice(2))
