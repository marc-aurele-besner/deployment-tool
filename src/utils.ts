import { spawn } from 'child_process'
import fs from 'fs'
import { exit } from 'process'

const sleep = async (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export const runCommand = async (command: string) => {
    try {
        let finishedRunning = false
        const runPush = await spawn(command, {
            stdio: 'inherit',
            shell: true
        })
        runPush.on('exit', (code) => {
            // exit()
            finishedRunning = true
        })
        // Keep waiting until the compiling is finished
        while (!finishedRunning) {
            await sleep(500)
        }
        return true
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error running command`, err)
        return false
    }
}

export const compileContract = async (env: any) => {
    try {
        await env.run('compile')
        console.log('\x1b[32m%s\x1b[0m', `Contracts have been compiled`)
        return true
    } catch (err) {
        console.log('\x1b[33m%s\x1b[0m', `Error compiling contract`, err)
        return false
    }
}

export const etherscanVerifyContract = async (env: any, contractAddress: string) => {
    try {
        await env.run('verify:verify', {
            address: contractAddress,
            constructorArguments: []
        })
        console.log('\x1b[32m%s\x1b[0m', `Contract: ${contractAddress} has been verify on etherscan.io`)
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
            // Separate the commit id from the rest of the commit message
            commitId = lastGitCommitData.split(' ')[1].substring(0, 8)
            // Delete the temporary file
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

export const commitChanges = async (commitComment: string, filesToCommit: string) => {
    try {
        // Commit the new storage layout
        await runCommand('git commit -a -m "Contract-Deployment Utility: ' + commitComment + '"')
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
