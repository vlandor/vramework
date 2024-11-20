import * as ts from 'typescript'
import { addFileWithFactory } from './add-file-with-factory.js'
import { ImportMap } from './inspector.js'
import { addFileExtendsCoreType } from './add-file-extends-core-type.js'
import { RoutesMeta } from '@vramework/core/types/routes.types'
import { ScheduledTasksMeta } from '@vramework/core/types/schedule.types'
import { addRoute } from './add-route.js'
import { addSchedule } from './add-schedule.js'

export type PathToNameAndType = Map<
  string,
  { variable?: string; type?: string | null; typePath: string | null }[]
>

export interface VisitState {
  sessionServicesTypeImportMap: PathToNameAndType
  userSessionTypeImportMap: PathToNameAndType
  functionTypesImportMap: ImportMap
  metaInputTypes: Map<string, string>
  routesMeta: RoutesMeta
  scheduledTasksMeta: ScheduledTasksMeta
  inputTypes: Set<string>
  outputTypes: Set<string>
  filesWithRoutes: Set<string>
  filesWithScheduledTasks: Set<string>
  singletonServicesFactories: PathToNameAndType
  sessionServicesFactories: PathToNameAndType
  configFactories: PathToNameAndType
}

export const visit = (
  checker: ts.TypeChecker,
  node: ts.Node,
  state: VisitState
) => {
  addFileExtendsCoreType(
    node,
    checker,
    state.sessionServicesTypeImportMap,
    'CoreServices'
  )

  addFileExtendsCoreType(
    node,
    checker,
    state.userSessionTypeImportMap,
    'CoreUserSession'
  )

  addFileWithFactory(
    node,
    checker,
    state.singletonServicesFactories,
    'CreateSingletonServices'
  )

  addFileWithFactory(
    node,
    checker,
    state.sessionServicesFactories,
    'CreateSessionServices'
  )

  addFileWithFactory(
    node,
    checker,
    state.configFactories,
    'CreateConfig'
  )

  addRoute(node, checker, state)
  addSchedule(node, checker, state)

  ts.forEachChild(node, (child) => visit(checker, child, state))
}
