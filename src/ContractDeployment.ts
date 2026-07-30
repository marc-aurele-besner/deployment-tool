import deploy from './deploy.js'
import deployProxy from './deployProxy.js'
import upgradeProxy from './upgradeProxy.js'

import { AwesomeAddressBook } from 'hardhat-awesome-cli/plugin'
import type { HardhatRuntimeEnvironment } from 'hardhat/types/hre'
import type { NetworkConnection } from 'hardhat/types/network'

/**
 * Thin wrapper exposed to downstream Hardhat configs as
 * `hre.contractDeployment`. Construct one per task (Hardhat 3 makes a
 * new network connection per task invocation).
 */
export class ContractDeployment {
    constructor(
        private readonly hre: HardhatRuntimeEnvironment,
        private readonly connection: NetworkConnection,
        private readonly addressBook: AwesomeAddressBook
    ) {}

    public async deployContract(
        contractName: string,
        initializeArguments: any[] = [],
        initializeSignature: string = 'initialize',
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verify?: boolean
    ) {
        return deployProxy(
            this.connection,
            this.addressBook,
            this.hre,
            contractName,
            initializeArguments,
            initializeSignature,
            tag,
            extra,
            skipGit,
            verify
        )
    }

    public async upgradeContract(contractName: string, tag?: string, extra?: any, skipGit?: boolean, verify?: boolean) {
        return upgradeProxy(this.connection, this.addressBook, this.hre, contractName, tag, extra, skipGit, verify)
    }

    public async testDeployThenUpgradeContract(
        contractName: string,
        initializeArguments: any[] = [],
        initializeSignature: string = 'initialize',
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verify?: boolean
    ) {
        const deployed = await deployProxy(
            this.connection,
            this.addressBook,
            this.hre,
            contractName,
            initializeArguments,
            initializeSignature,
            tag,
            extra,
            skipGit,
            verify
        )
        const upgraded = await upgradeProxy(
            this.connection,
            this.addressBook,
            this.hre,
            contractName,
            tag,
            extra,
            skipGit,
            verify
        )
        // The deployment-tool API treats this as a single result; if either
        // step succeeded, surface it as success so callers can branch on the
        // final proxy state.
        if (upgraded.success) {
            return { ...upgraded, contract: deployed.contract }
        }
        return deployed
    }

    public async deployContractStatic(
        contractName: string,
        constructorArguments: any[] = [],
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verify?: boolean
    ) {
        return deploy(
            this.connection,
            this.addressBook,
            this.hre,
            contractName,
            constructorArguments,
            tag,
            extra,
            skipGit,
            verify
        )
    }
}
