import { spawn } from 'child_process'
import fs from 'fs'
import type { NetworkConnection } from 'hardhat/types/network'

import { verifyContract } from '@nomicfoundation/hardhat-verify/verify'

/**
 * Run a shell command and wait for it to exit.
 *
 * Resolves to `true` only when the child exits with code 0 (the standard
 * "success" exit code for `git`, `cp`, etc.). Non-zero exits and spawn
 * errors (e.g. command not found) resolve to `false` so callers can
 * surface the failure instead of silently treating git/CI errors as
 * successful deploys.
 */
export const runCommand = (command: string): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
            const child = spawn(command, {
                stdio: 'inherit',
                shell: true
            })
            child.on('error', (err) => {
                console.log('\x1b[33m%s\x1b[0m', `Error running command`, err)
                resolve(false)
            })
            child.on('exit', (code, signal) => {
                if (code === 0) {
                    resolve(true)
                    return
                }
                const reason = code !== null ? `exit code ${code}` : signal ? `signal ${signal}` : 'unknown reason'
                console.log('\x1b[33m%s\x1b[0m', `Command failed (${reason}): ${command}`)
                resolve(false)
            })
        } catch (err) {
            console.log('\x1b[33m%s\x1b[0m', `Error running command`, err)
            resolve(false)
        }
    })
}

/**
 * Build the Solidity contracts through the supplied HRE.
 * In Hardhat 3 the compile pipeline is exposed as the `build` task; there is
 * no longer a `compile` task / `env.run('compile')` shortcut.
 */
export const compileContract = async (_connection: NetworkConnection, hre: any) => {
    try {
        await hre.tasks.getTask('build').run({})
        console.log('\x1b[32m%s\x1b[0m', `Contracts have been built`)
        return true
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error building contracts`, err)
        return false
    }
}

/**
 * Verify a contract on Etherscan (or another configured provider) using
 * the v3 {@link verifyContract} helper from `@nomicfoundation/hardhat-verify`.
 */
export const etherscanVerifyContract = async (hre: any, contractAddress: string, constructorArgs: any[] = []) => {
    try {
        await verifyContract(
            {
                address: contractAddress,
                constructorArgs
            },
            hre
        )
        console.log('\x1b[32m%s\x1b[0m', `Contract: ${contractAddress} has been verified on etherscan.io`)
        return true
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error verifying contract on etherscan.io`, err)
        return false
    }
}

export const addToCommit = async (filesToCommit: string) => {
    const ok = await runCommand('git add ' + filesToCommit)
    if (!ok) {
        console.log('\x1b[33m%s\x1b[0m', `Error git add ${filesToCommit}`)
        return false
    }
    console.log('\x1b[32m%s\x1b[0m', `Files: ${filesToCommit} has been added to the next commit`)
    return true
}

export const getLastCommit = async () => {
    const TEMP_FILE = 'lastGitCommit.txt'
    let commitId = ''
    try {
        const ok = await runCommand('git log -n 1 > ' + TEMP_FILE)
        // Only trust the file if the underlying `git log` succeeded; otherwise
        // the file may be empty or stale from a previous run.
        if (!ok) {
            return {
                success: false,
                commitId: ''
            }
        }
        if (fs.existsSync('./' + TEMP_FILE)) {
            const lastGitCommitData = fs.readFileSync('./' + TEMP_FILE, 'utf8')
            commitId = lastGitCommitData.split(' ')[1].substring(0, 8)
            fs.unlinkSync('./' + TEMP_FILE)
        } else console.log('\x1b[31m%s\x1b[0m', `Could not find ${TEMP_FILE}`)
        return {
            success: true,
            commitId
        }
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error git log last commit id`, err)
        return {
            success: false,
            commitId
        }
    }
}

export const commitChanges = async (commitComment: string, commitDescription: string, filesToCommit: string) => {
    // NOTE: deliberately NOT using `git commit -a`. `-a` would stage every
    // dirty file in the working tree (any unrelated local edits, scratch
    // notes, etc.) and commit it under the deployment message. We rely on
    // `addToCommit` having staged exactly `filesToCommit` ahead of time, and
    // a plain `git commit` then commits only what's in the index.
    const ok = await runCommand(`git commit -m "deployment-tool: ${commitComment}" -m "${commitDescription}"`)
    if (!ok) {
        console.log('\x1b[33m%s\x1b[0m', `Error git commit ${filesToCommit}`)
        return false
    }
    console.log('\x1b[32m%s\x1b[0m', `Files ${filesToCommit} are Committed in the repo`)
    return true
}

export const pullFromGit = async () => {
    const ok = await runCommand('git pull')
    if (!ok) {
        console.log('\x1b[33m%s\x1b[0m', `Error git pull`)
        return false
    }
    console.log('\x1b[32m%s\x1b[0m', `Git Pull is done`)
    return true
}

export const pushToGit = async (filesToCommit: string) => {
    const ok = await runCommand('git push')
    if (!ok) {
        console.log('\x1b[33m%s\x1b[0m', `Error git push ${filesToCommit}`)
        return false
    }
    console.log('\x1b[32m%s\x1b[0m', `Files ${filesToCommit} are Push in the repo`)
    return true
}
