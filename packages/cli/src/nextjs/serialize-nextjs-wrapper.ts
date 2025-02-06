export const serializeNextJsWrapper = (
  routesPath: string,
  routesMapPath: string,
  schemasPath: string,
  configImport: string,
  singleServicesFactoryImport: string,
  sessionServicesImport: string
) => {
  return `'server-only'

/**
 * This file provides a wrapper around the PikkuNextJS class to allow for methods to be type checked against your routes.
 * This ensures type safety for route handling methods when integrating with the \`@pikku/core\` framework.
 */
import { PikkuNextJS } from '@pikku/next'
import type { RoutesMap, RouteHandlerOf, RoutesWithMethod } from '${routesMapPath}'

${configImport}
${singleServicesFactoryImport}
${sessionServicesImport}

import '${routesPath}'
import '${schemasPath}'

let _pikku: PikkuNextJS | undefined

/**
 * Initializes and returns an instance of PikkuNextJS with helper methods for handling route requests.
 *
 * @returns An object containing methods for making dynamic and static action requests.
 */
export const pikku = () => {
  if (!_pikku) {
    _pikku = new PikkuNextJS(
      createConfig as any,
      createSingletonServices as any,
      createSessionServices
    )
  }

  /**
   * Makes a dynamic action request for a specified route and method.
   * Dynamic requests may access headers and cookies, making them unsuitable for precompile stages.
   *
   * @template Route - The route key from the RoutesMap.
   * @template Method - The method key from the specified route.
   * @param route - The route to make the request to.
   * @param method - The method to be used for the request.
   * @param data - The input data for the request, defaults to null.
   * @returns A promise that resolves to the output of the route handler.
   */
  const dynamicActionRequest = async <
    Route extends keyof RoutesMap,
    Method extends keyof RoutesMap[Route]
  >(
    route: Route,
    method: Method,
    data: RouteHandlerOf<Route, Method>['input'] = null
  ): Promise<RouteHandlerOf<Route, Method>['output']> => {
    return _pikku!.actionRequest(route, method, data as any)
  }

  /**
   * Makes a static action request for a specified route and method.
   * Static requests do not depend on headers or cookies and are suitable for precompile stages.
   *
   * @template Route - The route key from the RoutesMap.
   * @template Method - The method key from the specified route.
   * @param route - The route to make the request to.
   * @param method - The method to be used for the request.
   * @param data - The input data for the request, defaults to null.
   * @returns A promise that resolves to the output of the route handler.
   */
  const staticActionRequest = async <
    Route extends keyof RoutesMap,
    Method extends keyof RoutesMap[Route]
  >(
    route: Route,
    method: Method,
    data: RouteHandlerOf<Route, Method>['input'] = null
  ): Promise<RouteHandlerOf<Route, Method>['output']> => {
    return _pikku!.staticActionRequest(route, method, data as any)
  }

  /**
   * Makes a dynamic POST request for a specified route.
   */
  const dynamicPost = <Route extends RoutesWithMethod<'POST'>>(
    route: Route,
    data: RouteHandlerOf<Route, 'POST'>['input'] = null
  ): Promise<RouteHandlerOf<Route, 'POST'>['output']> => {
    return dynamicActionRequest(route, 'POST', data)
  }

  /**
   * Makes a dynamic GET request for a specified route.
   */
  const dynamicGet = <Route extends RoutesWithMethod<'GET'>>(
    route: Route,
    data: RouteHandlerOf<Route, 'GET'>['input'] = null
  ): Promise<RouteHandlerOf<Route, 'GET'>['output']> => {
    return dynamicActionRequest(route, 'GET', data)
  }

  /**
   * Makes a dynamic PATCH request for a specified route.
   */
  const dynamicPatch = <Route extends RoutesWithMethod<'PATCH'>>(
    route: Route,
    data: RouteHandlerOf<Route, 'PATCH'>['input'] = null
  ): Promise<RouteHandlerOf<Route, 'PATCH'>['output']> => {
    return dynamicActionRequest(route, 'PATCH', data)
  }

  /**
   * Makes a dynamic DELETE request for a specified route.
   */
  const dynamicDel = <Route extends RoutesWithMethod<'DELETE'>>(
    route: Route,
    data: RouteHandlerOf<Route, 'DELETE'>['input'] = null
  ): Promise<RouteHandlerOf<Route, 'DELETE'>['output']> => {
    return dynamicActionRequest(route, 'DELETE', data)
  }

  // Static

  /**
   * Makes a static POST request for a specified route.
   */
  const staticPost = <Route extends RoutesWithMethod<'POST'>>(
    route: Route,
    data: RouteHandlerOf<Route, 'POST'>['input'] = null
  ): Promise<RouteHandlerOf<Route, 'POST'>['output']> => {
    return staticActionRequest(route, 'POST', data)
  }

  /**
   * Makes a static GET request for a specified route.
   */
  const staticGet = <Route extends RoutesWithMethod<'GET'>>(
    route: Route,
    data: RouteHandlerOf<Route, 'GET'>['input'] = null
  ): Promise<RouteHandlerOf<Route, 'GET'>['output']> => {
    return staticActionRequest(route, 'GET', data)
  }

  return {
    get: dynamicGet,
    post: dynamicPost,
    patch: dynamicPatch,
    del: dynamicDel,
    staticGet,
    staticPost
  }
}`
}
