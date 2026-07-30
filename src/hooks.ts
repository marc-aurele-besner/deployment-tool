import { resolveUserConfig } from './index.js'

/**
 * Hardhat 3 calls this hook once per `HardhatRuntimeEnvironment` instance.
 * Returning the handler object as the `default` export lets
 * `hookHandlers.config` (`./index.ts`) wire it up without wrapping it
 * again on the consumer side.
 */
export default async function configHookHandlerFactory() {
    return { resolveUserConfig }
}
