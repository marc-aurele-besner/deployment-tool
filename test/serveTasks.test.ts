import { strict as assert } from 'assert'

import { parseBooleanArg } from '../src/serveTasks.js'

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
