import { Command } from 'commander'
import {
  getVrameworkCLIConfig,
  VrameworkCLIConfig,
} from '../src/vramework-cli-config.js'
import { serializeRoutes } from '../src/serializer/serialize-routes.js'
import { serializeRouteMeta } from '../src/serializer/serialize-route-meta.js'
import { serializeTypedRouteRunner } from '../src/serializer/serialize-typed-route-runner.js'
import { VisitState } from '../src/inspector/visit.js'
import { inspectorGlob } from '../src/inspector/inspector-glob.js'
import {
  getFileImportRelativePath,
  logCommandInfoAndTime,
  logVrameworkLogo,
  VrameworkCLIOptions,
  writeFileInDir,
} from '../src/utils.js'
import { serializeSchedulers } from '../src/serializer/serialize-schedulers.js'

export const vrameworkRoutes = async (
  cliConfig: VrameworkCLIConfig,
  visitState: VisitState
) => {
  return await logCommandInfoAndTime(
    'Finding routes',
    'Found routes',
    async () => {
      const { routesMapDeclarationFile, routesFile, packageMappings, esm } =
        cliConfig
      const { filesWithRoutes, filesWithScheduledTasks, routesMeta } = visitState
      const content = [
        serializeRoutes(routesFile, filesWithRoutes, packageMappings, esm),
        serializeSchedulers(routesFile, filesWithScheduledTasks, packageMappings, esm),
        serializeRouteMeta(routesMeta),
        serializeTypedRouteRunner(
          getFileImportRelativePath(
            routesFile,
            routesMapDeclarationFile,
            packageMappings,
            cliConfig.esm
          )
        ),
      ]
      await writeFileInDir(routesFile, content.join('\n\n'))
    }
  )
}

async function action(cliOptions: VrameworkCLIOptions): Promise<void> {
  logVrameworkLogo()

  const cliConfig = await getVrameworkCLIConfig(cliOptions.config, [
    'rootDir',
    'routeDirectories',
    'routesFile',
  ])
  const visitState = await inspectorGlob(
    cliConfig.rootDir,
    cliConfig.routeDirectories
  )
  await vrameworkRoutes(cliConfig, visitState)
}

export const routes = (program: Command): void => {
  program
    .command('routes')
    .description('Find all routes to import')
    .option('-c | --config <string>', 'The path to vramework cli config file')
    .action(action)
}

