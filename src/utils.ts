import { spawn } from 'child_process'
import fs from 'fs'
import type { NetworkConnection } from 'hardhat/types/network'

import { verifyContract } from '@nomicfoundation/hardhat-verify/verify'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const runCommand = async (command: string) => {
    try {
        let finishedRunning = false
        const runPush = spawn(command, {
            stdio: 'inherit',
            shell: true
        })
        runPush.on('exit', (_code) => {
            finishedRunning = true
        })
        while (!finishedRunning) {
            await sleep(500)
        }
        return true
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error running command`, err)
        return false
    }
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
    try {
        await runCommand('git add ' + filesToCommit)
        console.log('\x1b[32m%s\x1b[0m', `Files: ${filesToCommit} has been added to the next commit`)
        return true
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error git add`, err)
        return false
    }
}

export const getLastCommit = async () => {
    const TEMP_FILE = 'lastGitCommit.txt'
    let commitId = ''
    try {
        await runCommand('git log -n 1 > ' + TEMP_FILE)
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
    try {
        await runCommand(`git commit -a -m "deployment-tool: ${commitComment}" -m "${commitDescription}"`)
        console.log('\x1b[32m%s\x1b[0m', `Files ${filesToCommit} are Committed in the repo`)
        return true
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error git commit`, err)
        return false
    }
}

export const pullFromGit = async () => {
    try {
        await runCommand('git pull')
        console.log('\x1b[32m%s\x1b[0m', `Git Pull is done`)
        return true
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error git pull`, err)
        return false
    }
}

export const pushToGit = async (filesToCommit: string) => {
    try {
        await runCommand('git push')
        console.log('\x1b[32m%s\x1b[0m', `Files ${filesToCommit} are Push in the repo`)
        return true
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error git push`, err)
        return false
    }
}
