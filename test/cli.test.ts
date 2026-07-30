import { strict as assert } from 'assert'

import { TASKS, formatUsage, parseCliArgs, readVersion, runCli, type CliIo } from '../src/cli.js'
import deploymentToolPlugin from '../src/index.js'

/**
 * Unit tests for the standalone `deployment-tool` binary (issue #102).
 *
 * `package.json` previously pointed `bin` at `dist/index.js`, the Hardhat
 * plugin module. Running `deployment-tool` therefore evaluated a
 * `definePlugin(...)` call and exited without output. `src/cli.ts` replaces
 * it with a real CLI that prints usage, reports its version, and delegates
 * task names to `npx hardhat <task>`.
 */

/** Collects CLI output instead of writing to the real stdio. */
const makeIo = (): CliIo & { out: string[]; err: string[]; delegated: Array<[string, string[]]> } => {
    const out: string[] = []
    const err: string[] = []
    const delegated: Array<[string, string[]]> = []
    return {
        out,
        err,
        delegated,
        stdout: (line) => out.push(line),
        stderr: (line) => err.push(line),
        delegate: (task, args) => {
            delegated.push([task, args])
            return 0
        }
    }
}

describe('cli task catalog', function () {
    it('stays in sync with the tasks the plugin registers', function () {
        // The CLI keeps its own copy of the task list so `--help` works
        // without importing Hardhat. This guards against the two drifting.
        const pluginTasks = deploymentToolPlugin.tasks?.map((t) => t.id.join(' ')) ?? []
        assert.deepEqual(
            TASKS.map((t) => t.name),
            pluginTasks
        )
    })

    it('describes every task with the plugin description', function () {
        const byName = new Map((deploymentToolPlugin.tasks ?? []).map((t) => [t.id.join(' '), t.description]))
        for (const task of TASKS) assert.equal(task.description, byName.get(task.name))
    })
})

describe('parseCliArgs', function () {
    describe('help', function () {
        it('defaults to help when no arguments are given', function () {
            assert.deepEqual(parseCliArgs([]), { kind: 'help' })
        })

        it('treats an empty/whitespace argument as help', function () {
            assert.deepEqual(parseCliArgs(['']), { kind: 'help' })
            assert.deepEqual(parseCliArgs(['   ']), { kind: 'help' })
        })

        it('accepts -h, --help and help', function () {
            for (const flag of ['-h', '--help', 'help']) {
                assert.deepEqual(parseCliArgs([flag]), { kind: 'help' }, flag)
            }
        })
    })

    describe('version', function () {
        it('accepts -v, --version and version', function () {
            for (const flag of ['-v', '--version', 'version']) {
                assert.deepEqual(parseCliArgs([flag]), { kind: 'version' }, flag)
            }
        })
    })

    describe('task delegation', function () {
        it('recognises every registered task', function () {
            for (const task of TASKS) {
                assert.deepEqual(parseCliArgs([task.name]), { kind: 'delegate', task: task.name, args: [] })
            }
        })

        it('forwards the remaining arguments untouched', function () {
            assert.deepEqual(
                parseCliArgs(['deploy-contract', '--contract-name', 'Greeter', '--verify-contract', 'true']),
                {
                    kind: 'delegate',
                    task: 'deploy-contract',
                    args: ['--contract-name', 'Greeter', '--verify-contract', 'true']
                }
            )
        })

        it('does not treat a flag after the task name as a help request', function () {
            assert.deepEqual(parseCliArgs(['deploy-contract', '--help']), {
                kind: 'delegate',
                task: 'deploy-contract',
                args: ['--help']
            })
        })
    })

    describe('unknown commands', function () {
        it('reports an unrecognised command', function () {
            assert.deepEqual(parseCliArgs(['deploy']), { kind: 'unknown', command: 'deploy' })
            assert.deepEqual(parseCliArgs(['--nope']), { kind: 'unknown', command: '--nope' })
        })
    })
})

describe('formatUsage', function () {
    it('lists every task', function () {
        const usage = formatUsage('9.9.9')
        for (const task of TASKS) assert.ok(usage.includes(task.name), `missing ${task.name}`)
    })

    it('shows the version and points users at Hardhat', function () {
        const usage = formatUsage('9.9.9')
        assert.ok(usage.includes('9.9.9'))
        assert.ok(usage.includes('npx hardhat'))
    })
})

describe('readVersion', function () {
    it('resolves the package version rather than throwing', function () {
        const version = readVersion()
        assert.equal(typeof version, 'string')
        assert.notEqual(version, 'unknown')
    })
})

describe('runCli', function () {
    it('prints usage and exits 0 with no arguments', function () {
        const io = makeIo()
        assert.equal(runCli([], io), 0)
        assert.equal(io.out.length, 1)
        assert.ok(io.out[0].includes('USAGE'))
        assert.equal(io.err.length, 0)
    })

    it('prints the bare version for --version', function () {
        const io = makeIo()
        assert.equal(runCli(['--version'], io), 0)
        assert.equal(io.out[0], readVersion())
    })

    it('delegates a task and returns the delegate exit code', function () {
        const io = makeIo()
        assert.equal(runCli(['upgrade-contract', '--tag', 'v2'], io), 0)
        assert.deepEqual(io.delegated, [['upgrade-contract', ['--tag', 'v2']]])
    })

    it('propagates a non-zero exit code from the delegated task', function () {
        const io = { ...makeIo(), delegate: () => 3 }
        assert.equal(runCli(['deployment'], io), 3)
    })

    it('exits 1 and writes usage to stderr for an unknown command', function () {
        const io = makeIo()
        assert.equal(runCli(['bogus'], io), 1)
        assert.equal(io.out.length, 0)
        assert.ok(io.err[0].includes("unknown command 'bogus'"))
        assert.ok(io.err[1].includes('USAGE'))
    })

    it('never spawns Hardhat for help or version', function () {
        const io = makeIo()
        runCli(['--help'], io)
        runCli(['--version'], io)
        assert.deepEqual(io.delegated, [])
    })
})
