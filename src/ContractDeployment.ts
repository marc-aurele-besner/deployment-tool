import { extendEnvironment, task } from 'hardhat/config'

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
        await deployProxy(
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
        await upgradeProxy(this._env, contractName, tag, extra, skipGit, verifyContract)
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
        await deployProxy(
            this._env,
            contractName,
            initializeArguments,
            initializeSignature,
            tag,
            extra,
            skipGit,
            verifyContract
        )
        await upgradeProxy(this._env, contractName, tag, extra, skipGit, verifyContract)
    }
}
