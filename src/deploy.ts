import {
    addToCommit,
    commitChanges,
    compileContract,
    etherscanVerifyContract,
    getLastCommit,
    pullFromGit,
    pushToGit
} from './utils.js'

import type { NetworkConnection } from 'hardhat/types/network'
import type { AwesomeAddressBook } from 'hardhat-awesome-cli/plugin'

export const deploy = async (
    connection: NetworkConnection,
    addressBook: AwesomeAddressBook,
    hre: any,
    contractName: string,
    constructorArguments: any[] = [],
    tag?: string,
    extra?: any,
    skipGit = false as boolean,
    verifyContract = true as boolean,
    forceSave = false as boolean
): Promise<{
    success: boolean
    message: string
    error?: string
    contractName?: string
    contract?: any
    address?: string
}> => {
    try {
        const logOutput: Array<{ contractName: string; address: string; network: string }> = []
        let deployedContract: any = null

        // Build contracts (no-op if already up-to-date).
        await compileContract(connection, hre)

        // Get deployer account.
        const [deployer] = await connection.ethers.getSigners()

        // Get factory.
        const contractInterface = await connection.ethers.getContractFactory(contractName)

        // Deploy the contract.
        deployedContract = await contractInterface.deploy(...constructorArguments)

        // Wait for the deployment to be mined. In Hardhat 3 / ethers v6 the
        // returned contract exposes `deploymentTransaction()` (method) rather
        // than the v5 `deployTransaction` (property).
        const deployedContractTnx = await deployedContract.deploymentTransaction().wait()
        await deployedContract.waitForDeployment()

        // Save deployment arguments.
        const extraData = {
            ...extra,
            constructorArguments
        }

        // Save the deployment details to the address book.
        addressBook.saveContract(
            contractName,
            deployedContract.target as string,
            connection.networkName,
            deployer.address,
            connection.networkConfig.chainId ? Number(connection.networkConfig.chainId) : 0,
            deployedContractTnx.blockHash,
            deployedContractTnx.blockNumber,
            tag,
            extraData,
            forceSave
        )
        logOutput.push({
            contractName,
            address: deployedContract.target as string,
            network: connection.networkName
        })

        console.log('\x1b[32m%s\x1b[0m', `${contractName} deployed at address: `, deployedContract.target)

        // Verify the contract.
        if (verifyContract) await etherscanVerifyContract(hre, deployedContract.target as string, constructorArguments)

        if (!skipGit) {
            const filesToCommit = `.openzeppelin/ contractsAddressDeployed.json contractsAddressDeployedHistory.json`
            const isAddedToCommit = await addToCommit(filesToCommit)
            let isCommitted = false

            const lastCommit = await getLastCommit()
            if (isAddedToCommit && lastCommit.success)
                isCommitted = await commitChanges(
                    `🆕 ${contractName} deployed from commitId: ${lastCommit.commitId}`,
                    `Network: ${connection.networkName}, Deployer: ${deployer.address}, Contract Address: ${
                        deployedContract.target
                    }, Constructor Arguments: ${JSON.stringify(constructorArguments)}`,
                    filesToCommit
                )
            let isPull = false
            if (isCommitted) isPull = await pullFromGit()
            if (isPull) await pushToGit(filesToCommit)
        } else console.log('Skipping git commit, pull & push')

        if (logOutput.length > 0) console.table(logOutput)

        return {
            success: true,
            message: 'Deployment successful',
            contractName,
            contract: deployedContract,
            address: deployedContract.target
        }
    } catch (err) {
        console.error('deploy error:', err)
        return {
            success: false,
            message: 'Deployment failed',
            error: (err as Error)?.message ?? String(err)
        }
    }
}

export default deploy
