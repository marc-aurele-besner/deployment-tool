import {
    addToCommit,
    commitChanges,
    compileContract,
    etherscanVerifyContract,
    getLastCommit,
    pullFromGit,
    pushToGit
} from './utils'

const upgradeProxy = async (
    env: any,
    contractName: string,
    tag?: string,
    extra?: any,
    skipGit?: boolean,
    verifyContract?: boolean
): Promise<{
    success: boolean
    message: string
    contractName?: string
    contract?: any
    proxyAdminAddress?: string
    proxyAddress?: string
}> => {
    try {
        // Set a timeout for the deployment
        let keepWaiting = true
        setTimeout(() => {
            keepWaiting = false
        }, 60000)

        const logOutput = []
        let upgradedContract: any = null
        let ProxyAdminAddress: string = ''

        while (keepWaiting) {
            // Get deployer account
            const [deployer] = await env.ethers.getSigners()

            // Make sure contract is compiled
            await compileContract(env)

            // Get Interface
            const contractInterface = await env.ethers.getContractFactory(contractName)

            // Get contract details
            const contractAddress = await env.addressBook.retrieveContract(contractName, env.network.name)

            // Sanity check on contract address
            if (!contractAddress) throw new Error(`Contract ${contractName} not found in address book`)
            
            // Deploy Proxy & initialize it
            upgradedContract = await env.upgrades.upgradeProxy(contractAddress, contractInterface)

            // Get Transaction Receipt
            const upgradedContractTnx = await upgradedContract.deployTransaction.wait()

            // Save the deployment details
            await env.addressBook.saveContract(
                contractName,
                upgradedContract.address,
                env.network.name,
                deployer.address,
                upgradedContractTnx.blockHash,
                upgradedContractTnx.blockNumber,
                tag,
                extra
            )
            logOutput.push({
                contractName,
                address: upgradedContract.address,
                network: env.network.name
            })

            // Console log the address
            console.log('\x1b[32m%s\x1b[0m', `${contractName} upgraded at address: `, upgradedContract.address)

            // Retrieve Proxy Admin Address
            ProxyAdminAddress = await env.addressBook.retrieveOZAdminProxyContract(env.network.config.chainId)

            // Verify the contract
            if (verifyContract) await etherscanVerifyContract(env, upgradedContract.address)

            if (!skipGit) {
                // Add the contract address files and contract storage layout to the next commit
                const filesToCommit = `.openzeppelin/ contractsAddressDeployed.json contractsAddressDeployedHistory.json`
                const isAddedToCommit = await addToCommit(filesToCommit)
                let isCommitted = false

                // Get last CommitId
                const lastCommit = await getLastCommit()

                // Commit
                if (isAddedToCommit && lastCommit.success)
                    isCommitted = await commitChanges(
                        `💪 ${contractName} upgraded from commitId: ${lastCommit.commitId}`,
                        `Network: ${env.network.name}, Deployer: ${deployer.address}, Contract Address: ${upgradedContract.address}${ProxyAdminAddress ? ', Proxy Admin Address: ' + ProxyAdminAddress : ''}`,
                        filesToCommit
                    )
                let isPull = false

                // Pull
                if (isCommitted) isPull = await pullFromGit()

                // Push
                if (isPull) await pushToGit(filesToCommit)
            } else console.log('Skipping git commit, pull & push')
            // Exit
            keepWaiting = false

            // Return the deployed contract and Proxy Admin
            if (logOutput.length > 0) console.table(logOutput)
        }
        // Return the upgraded contract
        return {
            success: true,
            message: 'Upgrade successful',
            contractName,
            contract:  upgradedContract,
            proxyAdminAddress: ProxyAdminAddress,
            proxyAddress: upgradedContract.addressBook
        }
    } catch (err) {
        return {
            success: false,
            message: 'Upgrade failed',
        }
    }
}

export default upgradeProxy
