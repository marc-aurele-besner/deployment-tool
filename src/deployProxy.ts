import {
    addToCommit,
    commitChanges,
    compileContract,
    etherscanVerifyContract,
    getLastCommit,
    pullFromGit,
    pushToGit
} from './utils.js'

import { upgrades as upgradesFactory } from '@openzeppelin/hardhat-upgrades'
import type { AwesomeAddressBook } from 'hardhat-awesome-cli/plugin'
import type { NetworkConnection } from 'hardhat/types/network'

export const deployProxy = async (
    connection: NetworkConnection,
    addressBook: AwesomeAddressBook,
    hre: any,
    contractName: string,
    initializeArguments: any[] = [],
    initializeSignature: string = 'initialize',
    tag?: string,
    extra?: any,
    skipGit = false as boolean,
    verifyContractFlag = true as boolean,
    forceSave = false as boolean
): Promise<{
    success: boolean
    message: string
    contractName?: string
    contract?: any
    proxyAdminAddress?: string
    proxyAddress?: string
}> => {
    try {
        const logOutput: Array<{ contractName: string; address: string; network: string }> = []
        let deployedContract: any = null
        let ProxyAdminAddress: string = ''

        // Build contracts.
        await compileContract(connection, hre)

        // Get deployer account.
        const [deployer] = await connection.ethers.getSigners()

        // Get factory.
        const contractInterface = await connection.ethers.getContractFactory(contractName)

        // OpenZeppelin upgrades API takes (hre, connection) in v4 (instead of
        // the old `hre.upgrades` singleton) and returns a per-connection
        // upgrades object containing `deployProxy`.
        const upgrades = await upgradesFactory(hre, connection)

        // Deploy proxy & initialize it.
        deployedContract = await upgrades.deployProxy(contractInterface, initializeArguments, {
            initializer: initializeSignature
        } as any)

        // Hardhat 3 / OZ upgrades v4 normalizes the returned proxy to an ethers v6
        // contract instance whose deployment transaction is exposed via the
        // `deploymentTransaction()` method (the v2 `deployTransaction` property
        // is gone — `instance.deployTransaction` is undefined).
        const deployedContractTnx = await (deployedContract.deploymentTransaction() as any).wait()

        // Save deployment arguments.
        const extraData = {
            ...extra,
            initializeArguments,
            initializeSignature
        }

        // Save the deployment details.
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

        console.log('\x1b[32m%s\x1b[0m', `${contractName} deployed at address: `, deployedContract.target as string)

        try {
            ProxyAdminAddress = addressBook.retrieveOZAdminProxyContract(
                connection.networkConfig.chainId ? Number(connection.networkConfig.chainId) : 0
            )
            addressBook.saveContract('ProxyAdmin', ProxyAdminAddress, connection.networkName, deployer.address)
            logOutput.push({
                contractName: 'ProxyAdmin',
                address: ProxyAdminAddress,
                network: connection.networkName
            })
            console.log('Deployed using Proxy Admin contract address: ', ProxyAdminAddress)
        } catch (error) {
            console.log('Error retrieving Proxy Admin Address: ', error)
        }

        if (verifyContractFlag) await etherscanVerifyContract(hre, deployedContract.target as string)

        if (!skipGit) {
            const filesToCommit = `.openzeppelin/ contractsAddressDeployed.json contractsAddressDeployedHistory.json`
            const isAddedToCommit = await addToCommit(filesToCommit)
            let isCommitted = false
            const lastCommit = await getLastCommit()

            if (isAddedToCommit && lastCommit.success)
                isCommitted = await commitChanges(
                    `🆕 ${contractName} deployed from commitId: ${lastCommit.commitId}`,
                    `Network: ${connection.networkName}, Deployer: ${deployer.address}, Contract Address: ${
                        deployedContract.target as string
                    }, Initialize Arguments: ${JSON.stringify(
                        initializeArguments
                    )}, Initialize Signature: ${initializeSignature}, Proxy Admin Address: ${ProxyAdminAddress}`,
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
            proxyAdminAddress: ProxyAdminAddress,
            proxyAddress: deployedContract.target as string
        }
    } catch (err) {
        console.error('deployProxy error:', err)
        return {
            success: false,
            message: 'Deployment failed',
            error: (err as Error)?.message ?? String(err)
        } as any
    }
}

export default deployProxy
