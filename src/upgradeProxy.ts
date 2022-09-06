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
) => {
    try {
        // Set a timeout for the deployment
        let keepWaiting = true
        setTimeout(() => {
            keepWaiting = false
        }, 60000)

        const logOutput = []

        while (keepWaiting) {
            // Get deployer account
            const [deployer] = await env.ethers.getSigners()

            // Make sure contract is compiled
            await compileContract(env)

            // Get Interface
            const contractInterface = await env.ethers.getContractFactory(contractName)

            // Get contract details
            const contractAddress = await env.addressBook.retrieveContract(contractName, env.network.name)

            // Deploy Proxy & initialize it
            const upgradedContract = await env.upgrades.upgradeProxy(contractAddress, contractInterface)

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
                        `Deployed ${contractName} from commitId: ${lastCommit.commitId}`,
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

            // Return the deployed contract
            return upgradedContract
        }
    } catch (err) {
        console.log(err)
    }
}

export default upgradeProxy
