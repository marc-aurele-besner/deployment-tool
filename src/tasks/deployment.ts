import type { NewTaskActionFunction } from 'hardhat/types/tasks'

import { createContractDeployment } from '../lib.js'
import serveTasks from '../serveTasks.js'

const handler: NewTaskActionFunction = async (_args, hre) => {
    const connection = await hre.network.connect()
    const cd = createContractDeployment(hre, connection)
    await serveTasks('', { contractName: undefined }, cd)
}

export default handler
