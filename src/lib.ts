import { AwesomeAddressBook } from 'hardhat-awesome-cli/plugin'
import type { HardhatRuntimeEnvironment } from 'hardhat/types/hre'
import type { NetworkConnection } from 'hardhat/types/network'

import { ContractDeployment } from './ContractDeployment.js'

/**
 * Build a {@link ContractDeployment} wired to the supplied Hardhat runtime
 * + network connection. Hardhat 3 dropped `extendEnvironment` (the v2 hook
 * used to attach `hre.contractDeployment`), so callers — including the
 * plugin's own task actions and downstream scripts — request the wrapper
 * via this factory instead.
 *
 * The `addressBook` is constructed per-call from the user's resolved config
 * so the same wrapper works for both the in-process plugin tasks and tests
 * that need to point at a temp directory.
 */
export const createContractDeployment = (
    hre: HardhatRuntimeEnvironment,
    connection: NetworkConnection,
    addressBook?: AwesomeAddressBook
): ContractDeployment => {
    const book = addressBook ?? new AwesomeAddressBook(hre.config as any, connection.networkName)
    return new ContractDeployment(hre, connection, book)
}

export { ContractDeployment }
