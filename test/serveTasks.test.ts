import { strict as assert } from 'assert'

import inquirer from 'inquirer'

import { INTERACTIVE_BANNER, INTERACTIVE_CHOICES, parseBooleanArg, runInteractive } from '../src/serveTasks.js'

/**
 * Unit tests for the CLI boolean-argument parser used by every task runner
 * in {@link serveTasks}. The previous inline expression
 *
 *   value && value === 'true' ? true : !!value
 *
 * was broken: `!!'false'` is `true`, so `--skip-git false` and
 * `--verify-contract false` both enabled their respective features instead
 * of disabling them (issue #94).
 *
 * `parseBooleanArg` only accepts `'true'` / `'false'` (case-insensitive,
 * trimmed). Anything else — including the empty `''` default supplied by
 * Hardhat's `addOption` and `undefined` when the flag is omitted — yields
 * `undefined` so the caller can fall back to a downstream default.
 */
describe('parseBooleanArg', function () {
    describe('boolean inputs', function () {
        it('passes through a native `true`', function () {
            assert.equal(parseBooleanArg(true), true)
        })

        it('passes through a native `false`', function () {
            assert.equal(parseBooleanArg(false), false)
        })
    })

    describe('explicit "true" / "false" strings (issue #94 regression)', function () {
        it('treats the string "false" as false', function () {
            // Before the fix this returned `true` because `!!'false'` is `true`.
            assert.equal(parseBooleanArg('false'), false)
        })

        it('treats the string "true" as true', function () {
            assert.equal(parseBooleanArg('true'), true)
        })

        it('accepts mixed case ("False", "TRUE", "TrUe")', function () {
            assert.equal(parseBooleanArg('False'), false)
            assert.equal(parseBooleanArg('TRUE'), true)
            assert.equal(parseBooleanArg('TrUe'), true)
        })

        it('trims surrounding whitespace', function () {
            assert.equal(parseBooleanArg('  false  '), false)
            assert.equal(parseBooleanArg('\ttrue\n'), true)
        })
    })

    describe('absent / unrecognized inputs', function () {
        it('returns undefined for the empty default value from addOption', function () {
            assert.equal(parseBooleanArg(''), undefined)
        })

        it('returns undefined when the option is omitted entirely', function () {
            assert.equal(parseBooleanArg(undefined), undefined)
        })

        it('returns undefined for null', function () {
            assert.equal(parseBooleanArg(null), undefined)
        })

        it('returns undefined for junk that looks truthy (e.g. "yes")', function () {
            // We deliberately only honor 'true'/'false'; other strings like
            // 'yes', '1', or 'on' should NOT silently coerce, so the caller
            // can apply its downstream default instead of guessing.
            assert.equal(parseBooleanArg('yes'), undefined)
            assert.equal(parseBooleanArg('1'), undefined)
            assert.equal(parseBooleanArg('on'), undefined)
            assert.equal(parseBooleanArg('garbage'), undefined)
        })
    })

    describe('non-string primitives', function () {
        it('treats numeric 0 as unrecognized (returns undefined)', function () {
            assert.equal(parseBooleanArg(0), undefined)
        })

        it('treats numeric 1 as unrecognized (returns undefined)', function () {
            assert.equal(parseBooleanArg(1), undefined)
        })
    })
})

/**
 * Tests for the interactive menu constant and the non-interactive /
 * interactive dispatch in `runInteractive`.
 *
 * Background (issue #101):
 *  - The menu previously omitted `deploy-contract-static`, making the
 *    option only reachable via direct task invocation.
 *  - The banner was hard-coded as "Deployment tools for Gluwa", which
 *    predates the package's rename to `deployment-tool`.
 *  - Every interactive task called `.finally(() => process.exit(0))`,
 *    including after the inquirer action threw, so shell pipelines and CI
 *    saw a 0 exit code even when the deploy failed.
 */
describe('INTERACTIVE_CHOICES', function () {
    it('exposes every task the plugin can dispatch interactively', function () {
        // Source of truth lives in serveFunction's dispatch table — any new
        // task added there should also surface in the menu.
        assert.ok(INTERACTIVE_CHOICES.includes('deploy-contract'))
        assert.ok(INTERACTIVE_CHOICES.includes('upgrade-contract'))
        assert.ok(INTERACTIVE_CHOICES.includes('deploy-contract-static'))
        assert.ok(INTERACTIVE_CHOICES.includes('test-deploy-then-upgrade-contract'))
    })

    it('includes deploy-contract-static (issue #101 regression)', function () {
        // Before the fix this assertion failed — the entry was missing,
        // so users had to know the task name to deploy a static contract.
        assert.ok(INTERACTIVE_CHOICES.includes('deploy-contract-static'))
    })
})

describe('INTERACTIVE_BANNER', function () {
    it('does not reference the old Gluwa branding (issue #101)', function () {
        assert.ok(!INTERACTIVE_BANNER.toLowerCase().includes('gluwa'))
    })

    it('mentions the package name', function () {
        assert.ok(INTERACTIVE_BANNER.toLowerCase().includes('deployment-tool'))
    })
})

/**
 * `inquirer.prompt` returns an array of questions to its UI driver.
 * To drive it from a test, we replace `inquirer.prompt` with a function
 * that resolves a mocked promise-shaped object compatible with `.then /
 * .catch / .finally`. The minimal shape is a thenable that resolves to
 * the supplied answers.
 */
const stubInquirerPrompt = (answers: Record<string, unknown>) => {
    const promise = Promise.resolve(answers) as unknown as {
        then: <T>(onFulfilled?: (v: unknown) => T | PromiseLike<T>) => Promise<T>
        catch: <T>(onRejected?: (e: unknown) => T | PromiseLike<T>) => Promise<T>
        finally: (onFinally?: () => void) => Promise<unknown>
    }
    return promise
}

const stubInquirerPromptRejected = (err: unknown) => {
    return Promise.reject(err) as unknown as ReturnType<typeof stubInquirerPrompt>
}

describe('runInteractive', function () {
    let originalPrompt: typeof inquirer.prompt
    let originalExit: typeof process.exit

    /** Captured calls to `process.exit`. Cleared at the start of each test. */
    const exitCalls: number[] = []

    beforeEach(function () {
        originalPrompt = inquirer.prompt
        originalExit = process.exit
        exitCalls.length = 0
        // inquirer.prompt is overloaded — replace it with a generic stub.
        ;(inquirer as unknown as { prompt: unknown }).prompt = () => {
            throw new Error('inquirer.prompt was not stubbed for this test')
        }
        // process.exit must not actually terminate the test runner.
        process.exit = ((code?: number) => {
            exitCalls.push(code ?? 0)
            // Returning undefined mimics the real signature.
            return undefined as never
        }) as typeof process.exit
    })

    afterEach(function () {
        ;(inquirer as unknown as { prompt: typeof inquirer.prompt }).prompt = originalPrompt
        process.exit = originalExit
    })

    describe('when args already include a contract name', function () {
        it('runs the action without ever calling process.exit', async function () {
            let invoked = false
            await runInteractive({ contractName: 'Greeter' }, [], async (answers) => {
                invoked = true
                assert.equal(answers.contractName, 'Greeter')
            })
            assert.equal(invoked, true)
            // No prompt was shown, so the function must not have asserted any
            // exit code — Hardhat decides the exit code from whether the
            // action resolved or rejected.
            assert.deepEqual(exitCalls, [])
        })

        it('propagates errors from the action instead of swallowing them', async function () {
            // The non-interactive path never calls process.exit, so an
            // exception must propagate so Hardhat can return a non-zero
            // exit code.
            await assert.rejects(
                runInteractive({ contractName: 'Greeter' }, [], async () => {
                    throw new Error('boom')
                }),
                /boom/
            )
            assert.deepEqual(exitCalls, [])
        })

        it('treats empty-string and undefined contractName as the prompt path', async function () {
            // Empty string is what Hardhat's addOption defaultValue emits;
            // undefined is what the bare `deployment` task emits. Both must
            // trigger the prompt rather than dispatching empty args.
            const observed: string[] = []
            ;(inquirer as unknown as { prompt: (q: unknown) => unknown }).prompt = () =>
                stubInquirerPrompt({ contractName: 'Greeter' })
            await runInteractive({ contractName: '' }, [], async (answers) => {
                observed.push(answers.contractName)
            })
            assert.deepEqual(observed, ['Greeter'])
            // The prompt path always exits — success → 0.
            assert.deepEqual(exitCalls, [0])
        })
    })

    describe('exit codes on the interactive prompt path (issue #101)', function () {
        it('exits 0 when the action resolves', async function () {
            ;(inquirer as unknown as { prompt: (q: unknown) => unknown }).prompt = () =>
                stubInquirerPrompt({ contractName: 'Greeter' })
            await runInteractive({}, [], async () => {
                // success
            })
            assert.deepEqual(exitCalls, [0])
        })

        it('exits 1 when the action throws (previously exited 0)', async function () {
            // Before the fix the .finally unconditionally called
            // process.exit(0), masking failures from CI and shell pipelines.
            ;(inquirer as unknown as { prompt: (q: unknown) => unknown }).prompt = () =>
                stubInquirerPrompt({ contractName: 'Greeter' })
            await runInteractive({}, [], async () => {
                throw new Error('boom')
            })
            assert.deepEqual(exitCalls, [1])
        })

        it('exits 1 when the inquirer prompt itself rejects', async function () {
            // A cancelled (Ctrl-C) inquirer session rejects its promise;
            // we still want a non-zero exit so callers see the failure.
            ;(inquirer as unknown as { prompt: (q: unknown) => unknown }).prompt = () =>
                stubInquirerPromptRejected(new Error('cancelled'))
            await runInteractive({}, [], async () => {
                // never reached
            })
            assert.deepEqual(exitCalls, [1])
        })
    })
})
