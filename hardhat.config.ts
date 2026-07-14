import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
import 'hardhat-awesome-cli'

// Load the plugin under test. Side-effect imports register tasks
// and extend the Hardhat runtime with `contractDeployment`.
import './src/index'

const config = {
    solidity: {
        compilers: [
            {
                version: '0.8.20',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            }
        ]
    },
    networks: {
        hardhat: {
            // Allow large contracts (the OZ proxy + impl pattern can exceed the default).
            allowUnlimitedContractSize: true
        }
    }
}

export default config