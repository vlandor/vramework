import { getErrorResponse, NotFoundError, NotImplementedError } from "./errors"
import { verifyPermissions } from "./permissions"
import { CoreAPIRoute, CoreAPIRoutes } from "./routes"
import { loadSchema, validateJson } from "./schema"
import { CoreSingletonServices, CreateSessionServices, RequestHeaders } from "./types"
// @ts-ignore
import { match } from "path-to-regexp"
import { v4 as uuid } from 'uuid'
import { VrameworkRequest } from "./vramework-request"
import { VrameworkResponse } from "./vramework-response"

export const getMatchingRoute = (
  logger: CoreSingletonServices['logger'],
  requestType: string,
  requestPath: string,
  routes: Array<CoreAPIRoute<unknown, unknown>>,
) => {
  let matchedPath: any | undefined
  for (const route of routes) {
    if (route.type !== requestType.toLowerCase()) {
      continue
    }
    const matchFunc = match(`/${route.route}`.replace(/^\/\//, '/'), { decode: decodeURIComponent })
    matchedPath = matchFunc(requestPath)
    if (matchedPath) {
      if (route.schema) {
        loadSchema(route.schema, logger)
      }
      return { matchedPath, route }
    }
  }
  logger.info({ message: 'Invalid route', requestPath, requestType })
  throw new NotFoundError()
}

export const runRoute = async <In, Out>(
  request: VrameworkRequest<In>,
  response: VrameworkResponse,
  services: CoreSingletonServices,
  createSessionServices: CreateSessionServices,
  routes: CoreAPIRoutes,
  { route: apiRoute, type: apiType }: Pick<CoreAPIRoute<unknown, unknown>, 'route' | 'type'>,
): Promise<Out> => {
  try {
    const { matchedPath, route } = getMatchingRoute(services.logger, apiType, apiRoute, routes)
    services.logger.info({ message: 'Executing route', matchedPath, route })
    let session

    try {
      if (services.sessionService) {
        session = await services.sessionService?.getUserSession(
          route.requiresSession !== false,
          request
        )
      } else if (route.requiresSession) {
        throw new NotImplementedError('Session service not implemented')
      }
    } catch (e: any) {
      services.logger.info({
        action: 'Rejecting route (invalid session)',
        path: matchedPath,
        route,
      })
      throw e
    }

    services.logger.info({
      action: 'Executing route',
      path: matchedPath,
      route,
    })

    const data = await request.getData(request.getHeader('Content-Type') || 'application/json',)

    if (route.schema) {
      validateJson(route.schema, data)
    }

    const sessionServices = await createSessionServices(services, session, request, response)
    if (route.permissions) {
      await verifyPermissions(route.permissions, sessionServices, data, session)
    }

    const result: any = await route.func(sessionServices, data, session) as unknown as Out
    response.setStatus(200)
    if (route.returnsJSON) {
      response.setJson(result)
    } else {
      response.setResponse(result)
    }
    return result
  } catch (e) {
    const errorId = (e as any).errorId || uuid()
    const errorResponse = getErrorResponse(e)

    if (errorResponse != null) {
      response.setStatus(errorResponse.status)
      response.setJson({ message: errorResponse.message, payload: (e as any).payload, errorId })

      services.logger.warn(`Warning id: ${errorId}`)
      services.logger.warn(e)

    } else {
      services.logger.error(`Uncaught Error: ${e.message}`, e)
      console.trace(e)
      response.setStatus(500)
      response.setJson({ errorId })
    }

    throw e
  }
}