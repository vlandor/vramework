import type { HTTPFunctionsMeta } from '@vramework/core/http'

export const serializeHTTPRoutesMeta = (routesMeta: HTTPFunctionsMeta) => {
  const serializedOutput: string[] = []
  serializedOutput.push("import { setHTTPRoutesMeta } from '@vramework/core/http'")
  serializedOutput.push(`setHTTPRoutesMeta(${JSON.stringify(routesMeta, null, 2)})`)
  return serializedOutput.join('\n')
}
