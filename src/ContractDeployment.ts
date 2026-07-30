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

    /**
     * Deploy an upgradeable proxy via {@link deployProxy}.
     *
     * `verify` defaults to `true` (forwarded to {@link deployProxy}); pass
     * `false` to skip Etherscan verification.
     */
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

    /**
     * Upgrade an existing proxy via {@link upgradeProxy}.
     *
     * `verify` defaults to `true` (forwarded to {@link upgradeProxy}); pass
     * `false` to skip Etherscan verification. Aligning the default with
     * {@link deployContract} ensures an upgrade verifies by default — both
     * proxy and new implementation are submitted to Etherscan (issue #97).
     *
     * `proxyAddress` and `fromContractName` are forwarded to
     * {@link upgradeProxy} so callers upgrading a renamed contract (e.g.
     * `GreeterV1` → `GreeterV2`) can supply either the explicit proxy
     * address or the previous contract name without pre-seeding the
     * address book (issue #99).
     */
    public async upgradeContract(
        contractName: string,
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verify?: boolean,
        proxyAddress?: string,
        fromContractName?: string
    ) {
        return upgradeProxy(
            this.connection,
            this.addressBook,
            this.hre,
            contractName,
            tag,
            extra,
            skipGit,
            verify,
            proxyAddress,
            fromContractName
        )
    }

    public async testDeployThenUpgradeContract(
        contractName: string,
        initializeArguments: any[] = [],
        initializeSignature: string = 'initialize',
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verify?: boolean,
        proxyAddress?: string,
        fromContractName?: string
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
            verify,
            proxyAddress,
            fromContractName
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
