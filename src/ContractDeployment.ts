import { extendEnvironment, task } from 'hardhat/config'

import deploy from './deploy'
import deployProxy from './deployProxy'
import upgradeProxy from './upgradeProxy'

export class ContractDeployment {
    private readonly _env: any

    constructor(hre: any) {
        this._env = hre
    }

    public async deployContract(
        contractName: string,
        initializeArguments: any[] = [],
        initializeSignature: string = 'initialize',
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verifyContract?: boolean
    ) {
        return deployProxy(
            this._env,
            contractName,
            initializeArguments,
            initializeSignature,
            tag,
            extra,
            skipGit,
            verifyContract
        )
    }

    public async upgradeContract(
        contractName: string,
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verifyContract?: boolean
    ) {
        return upgradeProxy(this._env, contractName, tag, extra, skipGit, verifyContract)
    }

    public async testDeployThenUpgradeContract(
        contractName: string,
        initializeArguments: any[] = [],
        initializeSignature: string = 'initialize',
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verifyContract?: boolean
    ) {
        await await deployProxy(
            this._env,
            contractName,
            initializeArguments,
            initializeSignature,
            tag,
            extra,
            skipGit,
            verifyContract
        )
        return upgradeProxy(this._env, contractName, tag, extra, skipGit, verifyContract)
    }

    public async deployContractStatic(
        contractName: string,
        constructorArguments: any[] = [],
        tag?: string,
        extra?: any,
        skipGit?: boolean,
        verifyContract?: boolean
    ) {
        return deploy(this._env, contractName, constructorArguments, tag, extra, skipGit, verifyContract)
    }
}
