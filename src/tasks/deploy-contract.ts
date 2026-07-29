import serveTasks from '../serveTasks.js'
import { createContractDeployment } from '../lib.js'
import type { NewTaskActionFunction } from 'hardhat/types/tasks'

const handler: NewTaskActionFunction = async (args, hre) => {
    const connection = await hre.network.connect()
    const cd = createContractDeployment(hre, connection)
    await serveTasks('deploy-contract', args, cd)
}

export default handler
