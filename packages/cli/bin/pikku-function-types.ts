import { Command } from 'commander'
import { getPikkuCLIConfig, PikkuCLIConfig } from '../src/pikku-cli-config.js'
import { InspectorState } from '@pikku/inspector'
import {
  getFileImportRelativePath,
  getPikkuFilesAndMethods,
  logCommandInfoAndTime,
  logPikkuLogo,
  PikkuCLIOptions,
  writeFileInDir,
} from '../src/utils.js'
import { pikkuRoutes } from './pikku-routes.js'
import { inspectorGlob } from '../src/inspector-glob.js'
import { serializePikkuTypes } from '../src/core/serialize-pikku-types.js'

export const pikkuFunctionTypes = async (
  { typesDeclarationFile: typesFile, packageMappings }: PikkuCLIConfig,
  options: PikkuCLIOptions,
  visitState: InspectorState
) => {
  await logCommandInfoAndTime(
    'Creating api types',
    'Created api types',
    [false],
    async () => {
      const { userSessionType, sessionServicesType } =
        await getPikkuFilesAndMethods(
          visitState,
          packageMappings,
          typesFile,
          options,
          { userSessionType: true, sessionServiceType: true }
        )
      const content = serializePikkuTypes(
        `import type { ${userSessionType.type} } from '${getFileImportRelativePath(typesFile, userSessionType.typePath, packageMappings)}'`,
        userSessionType.type,
        `import type { ${sessionServicesType.type} } from '${getFileImportRelativePath(typesFile, sessionServicesType.typePath, packageMappings)}'`,
        sessionServicesType.type
      )
      await writeFileInDir(typesFile, content)
    }
  )
}

async function action(cliOptions: PikkuCLIOptions): Promise<void> {
  logPikkuLogo()

  const cliConfig = await getPikkuCLIConfig(cliOptions.config, [
    'rootDir',
    'routeDirectories',
    'typesDeclarationFile',
  ])

  const visitState = await inspectorGlob(
    cliConfig.rootDir,
    cliConfig.routeDirectories
  )
  await pikkuRoutes(cliConfig, visitState)
}

export const functionTypes = (program: Command): void => {
  program
    .command('types')
    .description('Generate the core API')
    .option('-ct | --pikku-config-type', 'The type of your pikku config object')
    .option(
      '-ss | --singleton-services-factory-type',
      'The type of your singleton services factory'
    )
    .option(
      '-se | --session-services-factory-type',
      'The type of your session services factory'
    )
    .option('-c | --config <string>', 'The path to pikku cli config file')
    .action(action)
}
