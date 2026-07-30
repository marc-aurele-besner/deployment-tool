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

/**
 * Upgrade an existing proxy to a new implementation contract.
 *
 * @param verifyContractFlag Whether to verify both the proxy and the new
 *   implementation contract on Etherscan. Defaults to `true` so an upgrade
 *   that swaps the logic behind a proxy also updates the block-explorer
 *   view of that contract — verify on by default matches `deployProxy`'s
 *   default (issue #97). Pass `false` to skip verification (e.g. on
 *   networks that have no configured Etherscan key).
 * @param proxyAddress Optional explicit proxy address to upgrade. When
 *   provided, the address-book lookup is skipped entirely — useful when the
 *   caller already knows the proxy address (e.g. from a previous deploy
 *   result) and avoids having to seed the address book under the new
 *   contract name (issue #99).
 * @param fromContractName Optional name of the previous contract version
 *   whose recorded address-book entry holds the proxy. When provided, the
 *   proxy address is resolved via `addressBook.retrieveContract(from,
 *   network)` instead of looking the new `contractName` up. Lets users
 *   upgrade `GreeterV1` → `GreeterV2` without manually seeding the
 *   address book with a V2 → V1-address entry first (issue #99).
 */
export const upgradeProxy = async (
    connection: NetworkConnection,
    addressBook: AwesomeAddressBook,
    hre: any,
    contractName: string,
    tag?: string,
    extra?: any,
    skipGit = false as boolean,
    verifyContractFlag = true as boolean,
    proxyAddress?: string,
    fromContractName?: string
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
        let upgradedContract: any = null
        let ProxyAdminAddress: string = ''

        // Build contracts. If the build fails, abort before sending any
        // upgrade transaction — a broken implementation would brick the
        // proxy.
        const compiled = await compileContract(connection, hre)
        if (!compiled) {
            return {
                success: false,
                message: 'Compilation failed',
                error: 'Contracts failed to build; aborting upgrade before sending transactions.'
            } as any
        }

        const [deployer] = await connection.ethers.getSigners()
        const contractInterface = await connection.ethers.getContractFactory(contractName)

        // Resolve the proxy address with the precedence: explicit
        // `proxyAddress` > address-book lookup under `fromContractName` >
        // address-book lookup under `contractName` (issue #99). Without
        // `fromContractName` the upgrade of a renamed contract still
        // requires the caller to have seeded the address book under the
        // new name pointing at the old proxy address; supplying `from`
        // (or `proxyAddress`) lets the upgrade find the existing proxy
        // without that pre-seeding step.
        let contractAddress: string | undefined
        if (proxyAddress) {
            contractAddress = proxyAddress
        } else if (fromContractName) {
            contractAddress = addressBook.retrieveContract(fromContractName, connection.networkName)
        } else {
            contractAddress = addressBook.retrieveContract(contractName, connection.networkName)
        }
        if (!contractAddress) {
            const lookupTarget = fromContractName ?? contractName
            throw new Error(
                `Contract ${lookupTarget} not found in address book` +
                    (proxyAddress ? '' : ' — pass an explicit --proxy address or --from <previous-name>')
            )
        }

        const upgrades = await upgradesFactory(hre, connection)
        upgradedContract = await upgrades.upgradeProxy(contractAddress, contractInterface)

        // For an upgrade the relevant receipt is the implementation
        // deployment tx; falls back to no-op data when OZ hands us the
        // already-deployed proxy instance (where `deploymentTransaction`
        // resolves to `null`).
        const implTx = upgradedContract.deploymentTransaction() as any
        const upgradedContractTnx = implTx ? await implTx.wait() : { blockHash: '', blockNumber: 0 }

        addressBook.saveContract(
            contractName,
            upgradedContract.target as string,
            connection.networkName,
            deployer.address,
            connection.networkConfig.chainId ? Number(connection.networkConfig.chainId) : 0,
            upgradedContractTnx.blockHash,
            upgradedContractTnx.blockNumber,
            tag,
            extra
        )
        logOutput.push({
            contractName,
            address: upgradedContract.target as string,
            network: connection.networkName
        })

        console.log('\x1b[32m%s\x1b[0m', `${contractName} upgraded at address: `, upgradedContract.target as string)

        try {
            ProxyAdminAddress = addressBook.retrieveOZAdminProxyContract(
                connection.networkConfig.chainId ? Number(connection.networkConfig.chainId) : 0
            )
        } catch (error) {
            console.log('Error retrieving Proxy Admin Address from address book: ', error)
        }

        if (!ProxyAdminAddress) {
            try {
                ProxyAdminAddress = await upgrades.erc1967.getAdminAddress(upgradedContract.target as string)
            } catch (error) {
                console.log('Error retrieving Proxy Admin Address on-chain: ', error)
            }
        }

        // Verify the contracts on Etherscan. For an upgraded proxy the
        // proxy address is unchanged but the implementation contract behind
        // it has been replaced — verify both so block explorers reflect the
        // new logic.
        if (verifyContractFlag) {
            await etherscanVerifyContract(hre, upgradedContract.target as string)
            try {
                const implementationAddress = await upgrades.erc1967.getImplementationAddress(
                    upgradedContract.target as string
                )
                if (implementationAddress) {
                    await etherscanVerifyContract(hre, implementationAddress)
                } else {
                    console.log('Warning: could not resolve implementation address for verification')
                }
            } catch (error) {
                console.log('Error retrieving implementation address for verification: ', error)
            }
        }

        if (!skipGit) {
            const filesToCommit = `.openzeppelin/ contractsAddressDeployed.json contractsAddressDeployedHistory.json`
            const isAddedToCommit = await addToCommit(filesToCommit)
            let isCommitted = false
            const lastCommit = await getLastCommit()

            if (isAddedToCommit && lastCommit.success)
                isCommitted = await commitChanges(
                    `💪 ${contractName} upgraded from commitId: ${lastCommit.commitId}`,
                    `Network: ${connection.networkName}, Deployer: ${deployer.address}, Contract Address: ${
                        upgradedContract.target as string
                    }${ProxyAdminAddress ? ', Proxy Admin Address: ' + ProxyAdminAddress : ''}`,
                    filesToCommit
                )
            let isPull = false
            if (isCommitted) isPull = await pullFromGit()
            if (isPull) await pushToGit(filesToCommit)
        } else console.log('Skipping git commit, pull & push')

        if (logOutput.length > 0) console.table(logOutput)

        return {
            success: true,
            message: 'Upgrade successful',
            contractName,
            contract: upgradedContract,
            proxyAdminAddress: ProxyAdminAddress,
            proxyAddress: upgradedContract.target as string
        }
    } catch (err) {
        console.error('upgradeProxy error:', err)
        return {
            success: false,
            message: 'Upgrade failed',
            error: (err as Error)?.message ?? String(err)
        } as any
    }
}

export default upgradeProxy
