import 'hardhat/types/config'

declare module 'hardhat/types/config' {
    export interface ProjectPathsUserConfig {
        deployment?: string
    }
    export interface ProjectPathsConfig {
        deployment: string
    }
}

// `HardhatRuntimeEnvironment` is no longer extensible at runtime in Hardhat 3
// — the v2 `extendEnvironment` hook is gone. Tests and downstream consumers
// should construct `ContractDeployment` via the `createContractDeployment`
// factory exported from `./lib.ts` instead of attaching to HRE.
export {}
