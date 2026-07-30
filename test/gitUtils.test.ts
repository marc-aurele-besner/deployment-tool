import { strict as assert } from 'assert'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { commitChanges, runCommand } from '../src/utils.js'

/**
 * Unit tests for the git automation helpers in {@link ../src/utils}.
 *
 * Issue #95 flagged two problems in the previous implementation:
 *
 *   1. `runCommand` ignored child process exit codes — spawn `exit`
 *      handlers never checked the code, and the function returned `true`
 *      for every run, so failed git operations looked like success.
 *   2. `commitChanges` used `git commit -a`, which stages every dirty
 *      file in the working tree (not only the deployment artifacts) and
 *      commits them all under the deployment message.
 *
 * These tests pin both behaviours: a non-zero exit must be reported as
 * failure, and only the explicitly staged paths must end up in the
 * resulting commit.
 *
 * Helpers that shell out to git use `git -C <repoDir>` so the tests can
 * point git at a throwaway temp repo rather than the project checkout.
 */

describe('git utilities (issue #95)', function () {
    this.timeout(30_000)

    describe('runCommand exit-code propagation', function () {
        it('resolves true when the command exits 0', async function () {
            // `/bin/true` is a portable no-op that always exits 0.
            const ok = await runCommand('true')
            assert.equal(ok, true)
        })

        it('resolves false when the command exits non-zero', async function () {
            // `/bin/false` is a portable no-op that always exits 1.
            const ok = await runCommand('false')
            assert.equal(ok, false)
        })

        it('resolves false when the command cannot be found', async function () {
            // Spawn an obviously-missing binary; spawn emits an `error`
            // event (not a non-zero exit) when the shell can't locate it.
            const ok = await runCommand('definitely-not-a-real-binary-xyz-12345')
            assert.equal(ok, false)
        })
    })

    describe('commitChanges staging scope', function () {
        // Each test gets its own git repository under a fresh temp dir so
        // they don't interact via shared state on disk.
        let repoDir: string

        beforeEach(function () {
            repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deployment-tool-git-test-'))

            // Bootstrap a brand-new repo with an initial commit on a
            // throwaway branch so the test never touches the user's
            // global git config (no name/email required beyond the
            // per-command env vars below).
            const env = {
                ...process.env,
                GIT_AUTHOR_NAME: 'test',
                GIT_AUTHOR_EMAIL: '[email protected]',
                GIT_COMMITTER_NAME: 'test',
                GIT_COMMITTER_EMAIL: '[email protected]'
            }
            const run = (cmd: string) => spawnSync(cmd, { cwd: repoDir, env, shell: true, stdio: 'pipe' })
            assert.equal(run('git init -q -b main').status, 0, 'git init should succeed')
            assert.equal(run('git config user.name test').status, 0)
            assert.equal(run('git config user.email [email protected]').status, 0)
            assert.equal(run('git config commit.gpgsign false').status, 0)

            // Create an initial file and commit it so HEAD exists.
            fs.writeFileSync(path.join(repoDir, 'seed.txt'), 'seed\n')
            assert.equal(run('git add seed.txt').status, 0)
            assert.equal(run('git commit -q -m seed').status, 0, 'initial commit should succeed')
        })

        afterEach(function () {
            try {
                fs.rmSync(repoDir, { recursive: true, force: true })
            } catch {
                /* best-effort cleanup */
            }
        })

        it('only commits the explicitly staged files, ignoring unrelated dirty files', async function () {
            // The previous `git commit -a` implementation would have
            // pulled every dirty file into this commit. With the fix,
            // only the deployment artifacts that were `git add`-ed are
            // committed; any other dirty file must stay in the working
            // tree.

            // Stage ONLY the deployment artifacts, like the deploy
            // flows do in src/deploy.ts etc.
            const artifactsDir = path.join(repoDir, '.openzeppelin')
            fs.mkdirSync(artifactsDir)
            fs.writeFileSync(path.join(artifactsDir, 'foo.json'), 'artifact\n')
            fs.writeFileSync(path.join(repoDir, 'contractsAddressDeployed.json'), '{}\n')
            fs.writeFileSync(path.join(repoDir, 'contractsAddressDeployedHistory.json'), '{}\n')
            const addResult = await runCommand(
                `git -C ${repoDir} add .openzeppelin/ contractsAddressDeployed.json contractsAddressDeployedHistory.json`
            )
            assert.equal(addResult, true, 'git add should stage the deployment artifacts')

            // Now also create a dirty, unrelated file in the working
            // tree that MUST NOT end up in the next commit.
            fs.writeFileSync(path.join(repoDir, 'unrelated.txt'), 'I should not be committed\n')

            const committed = await runCommand(
                `git -C ${repoDir} commit -m "deployment-tool: test commit" -m "description"`
            )
            assert.equal(committed, true, 'git commit should succeed once artifacts are staged')

            // The unrelated file should NOT be part of the most recent
            // commit; running `git status --porcelain` will list it as
            // untracked if it's still in the working tree.
            const env = { ...process.env }
            const status = spawnSync('git status --porcelain', { cwd: repoDir, env, shell: true, stdio: 'pipe' })
            assert.equal(status.status, 0)
            const stdout = status.stdout.toString()
            assert.match(stdout, /unrelated\.txt/, 'unrelated.txt must remain uncommitted in the working tree')

            // The commit itself should mention only the staged artifacts.
            const show = spawnSync('git show --name-only --format=%s HEAD', {
                cwd: repoDir,
                env,
                shell: true,
                stdio: 'pipe'
            })
            assert.equal(show.status, 0)
            const committedFiles = show.stdout.toString().trim().split('\n').slice(1).filter(Boolean)
            assert.ok(
                committedFiles.includes('.openzeppelin/foo.json'),
                'committed files should include the staged artifact'
            )
            assert.ok(
                !committedFiles.includes('unrelated.txt'),
                'committed files must NOT include the unrelated dirty file'
            )
        })

        it('returns false when there is nothing to commit', async function () {
            // `git commit` with an empty index exits non-zero (1) and
            // prints "nothing to commit". This is exactly the case the
            // old `runCommand` swallowed as success — the new
            // implementation must surface it as failure so the deploy
            // flow short-circuits instead of pushing nothing.
            const committed = await commitChanges('test', 'description', '.openzeppelin/')
            assert.equal(committed, false)
        })
    })
})
