import hardhatToolboxMochaEthersPlugin from '@nomicfoundation/hardhat-toolbox-mocha-ethers'
import hardhatAwesomeCliPlugin from 'hardhat-awesome-cli/plugin'
import ozUpgradesPlugin from '@openzeppelin/hardhat-upgrades'
import { defineConfig } from 'hardhat/config'

import deploymentToolPlugin from './src/index.js'

// Load the plugin under test. Hardhat 3 is declarative — plugins are added
// to the `plugins` array, not imported for side effects. We still import
// the default export to reference it in `plugins`.
const config = {
    plugins: [
        hardhatToolboxMochaEthersPlugin,
        ozUpgradesPlugin,
        hardhatAwesomeCliPlugin,
        deploymentToolPlugin
    ],
    solidity: {
        profiles: {
            default: {
                version: '0.8.20'
            },
            production: {
                version: '0.8.20',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            }
        }
    }
}

export default defineConfig(config)
