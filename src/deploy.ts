import {
    addToCommit,
    commitChanges,
    compileContract,
    etherscanVerifyContract,
    getLastCommit,
    pullFromGit,
    pushToGit
} from './utils'

const deploy = async (
    env: any,
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
        // Set a timeout for the deployment
        let keepWaiting = true
        setTimeout(() => {
            keepWaiting = false
        }, 60000)

        const logOutput = []
        let deployedContract: any = null

        while (keepWaiting) {
            // Get deployer account
            const [deployer] = await env.ethers.getSigners()

            // Make sure contract is compiled
            await compileContract(env)

            // Get Interface
            const contractInterface = await env.ethers.getContractFactory(contractName)

            // Deploy Proxy & initialize it
            deployedContract = await contractInterface.deploy(constructorArguments)

            // Get Transaction Receipt
            const deployedContractTnx = await deployedContract.deployTransaction.wait()
            await deployedContract.deployed()

            // Save deployment arguments
            const extraData = {
                ...extra,
                constructorArguments
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
                        }, Constructor Arguments: ${JSON.stringify(constructorArguments)}`,
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
            address: deployedContract.address
        }
    } catch (err) {
        return {
            success: false,
            message: 'Deployment failed',
            error: err as string
        }
    }
}

export default deploy
