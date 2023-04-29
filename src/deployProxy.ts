import {
    addToCommit,
    commitChanges,
    compileContract,
    etherscanVerifyContract,
    getLastCommit,
    pullFromGit,
    pushToGit
} from './utils'

const deployProxy = async (
    env: any,
    contractName: string,
    initializeArguments: any[] = [],
    initializeSignature: string = 'initialize',
    tag?: string,
    extra?: any,
    skipGit = false as boolean,
    verifyContract = true as boolean,
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
        // Set a timeout for the deployment
        let keepWaiting = true
        setTimeout(() => {
            keepWaiting = false
        }, 60000)

        const logOutput = []
        let deployedContract: any = null
        let ProxyAdminAddress: string = ''

        while (keepWaiting) {
            // Get deployer account
            const [deployer] = await env.ethers.getSigners()

            // Make sure contract is compiled
            await compileContract(env)

            // Get Interface
            const contractInterface = await env.ethers.getContractFactory(contractName)

            // Deploy Proxy & initialize it
            deployedContract = await env.upgrades.deployProxy(contractInterface, initializeArguments, {
                initializer: initializeSignature
            })

            // Get Transaction Receipt
            const deployedContractTnx = await deployedContract.deployTransaction.wait()

            // Save deployment arguments
            const extraData = {
                ...extra,
                initializeArguments,
                initializeSignature
            }

            // Save the deployment details
            await env.addressBook.saveContract(
                contractName,
                deployedContract.address,
                env.network.name,
                deployer.address,
                env.network.config.chainId,
                deployedContractTnx.blockHash,
                deployedContractTnx.blockNumber,
                tag,
                extraData,
                forceSave
            )
            logOutput.push({
                contractName,
                address: deployedContract.address,
                network: env.network.name
            })

            // Console log the address
            console.log('\x1b[32m%s\x1b[0m', `${contractName} deployed at address: `, deployedContract.address)

            try {
                // Retrieve Proxy Admin Address
                ProxyAdminAddress = await env.addressBook.retrieveOZAdminProxyContract(env.network.config.chainId)

                // Save Proxy Admin Address
                env.addressBook.saveContract('ProxyAdmin', ProxyAdminAddress, env.network.name, deployer.address)
                logOutput.push({
                    contractName: 'ProxyAdmin',
                    address: ProxyAdminAddress,
                    network: env.network.name
                })

                // Console log the address
                console.log('Deployed using Proxy Admin contract address: ', ProxyAdminAddress)
            } catch (error) {
                console.log('Error retrieving Proxy Admin Address: ', error)
            }

            // Verify the contract
            if (verifyContract) await etherscanVerifyContract(env, deployedContract.address)

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
                        `🆕 ${contractName} deployed from commitId: ${lastCommit.commitId}`,
                        `Network: ${env.network.name}, Deployer: ${deployer.address}, Contract Address: ${
                            deployedContract.address
                        }, Initialize Arguments: ${JSON.stringify(
                            initializeArguments
                        )}, Initialize Signature: ${initializeSignature}, Proxy Admin Address: ${ProxyAdminAddress}`,
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
        // Return the deployed contract{
        return {
            success: true,
            message: 'Deployment successful',
            contractName,
            contract: deployedContract,
            proxyAdminAddress: ProxyAdminAddress,
            proxyAddress: deployedContract.address
        }
    } catch (err) {
        return {
            success: false,
            message: 'Deployment failed'
        }
    }
}

export default deployProxy
