let apiPrefix = ''

let authHeaders: Record<'jwt' | 'apiKey' | 'orgId', string | undefined> = {
  jwt: undefined,
  apiKey: undefined,
  orgId: undefined
}

const getHeaders = () => {
  let headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authHeaders.jwt) {
    headers.Authorization = `Bearer ${authHeaders.jwt}`
  } else if (authHeaders.apiKey) {
    headers['X-API-KEY'] = authHeaders.apiKey
  }

  if (authHeaders.orgId) {
    headers['enjamon-org-id'] = authHeaders.orgId
  }

  return headers
}

export const transformResult = (data: any): any => {
  if (data === null) {
    return null
  }

  if (data instanceof Array) {
    return data.map(transformResult)
  }

  if (typeof data === 'object') {
    return Object.entries(data).reduce((result, [key, value]) => {
      result[key] = transformResult(value)
      return result
    }, {} as any)
  }

  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.\d{3}Z?)?/.test(data)) {
    return new Date(data)
  }

  return data
}

export const setAPIPrefix = async (prefix: string) => {
  apiPrefix = prefix
}

export const setAuthorizationJWT = (jwt: string) => {
  authHeaders.jwt = jwt
}

export const setAPIKey = (apiKey?: string) => {
  authHeaders.apiKey = apiKey
}

export const setOrgId = (orgId: string) => {
  authHeaders.orgId = orgId
}

async function action<O, I>(method: string, url: string, body: I, hasResponseBody?: true): Promise<O>
async function action<I>(method: string, url: string, body: I, hasResponseBody?: false): Promise<void>
async function action<O, I>(method: string, url: string, body: I, hasResponseBody = true): Promise<O | void> {
  const data = JSON.stringify(body)
  try {
    const response = await fetch(`${apiPrefix}/${url}`, {
      method,
      cache: 'no-cache',
      mode: 'cors',
      credentials: 'include',
      headers: getHeaders(),
      body: data,
    })
    if (response.status >= 400) {
      throw response
    }
    if (hasResponseBody) {
      const data = await response.json()
      return transformResult(data)
    }
  } catch (e: any) {
    // This is a 404
    throw e
  }
}

export async function post<O, I>(url: string, data: I, hasResponseBody?: true): Promise<O>
export async function post<I>(url: string, data: I, hasResponseBody?: false): Promise<void>
export async function post<O, I>(url: string, data: I, hasResponseBody = true): Promise<O | void> {
  if (hasResponseBody) {
    return await action('POST', url, data, true)
  }
  await action('POST', url, data, false)
}

export async function patch<O, I>(url: string, data: I, hasResponseBody?: boolean): Promise<O>
export async function patch<I>(url: string, data: I, hasResponseBody?: false): Promise<void>
export async function patch<O, I>(url: string, data: I, hasResponseBody = true): Promise<O | void> {
  if (hasResponseBody) {
    return await action('PATCH', url, data, true)
  }
  await action('PATCH', url, data, false)
}

export async function get<O, I = any>(
  url: string,
  query?: I,
): Promise<O> {
  let uri = `${apiPrefix}/${url}`
  if (query) {
    // removes all the undefined
    const params = new URLSearchParams(JSON.parse(JSON.stringify(query)))
    uri = `${apiPrefix}/${url}?${params}`
  }
  const response = await fetch(uri, {
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
    headers: getHeaders()
  })
  if (response.status > 400) {
    throw response
  }
  try {
    return await response.json()
  } catch (e: any) {
    throw 'Unable to parse json response'
  }
}

export async function head(url: string, query?: Record<string, string>): Promise<number> {
  let uri = `${apiPrefix}/${url}`
  if (query) {
    const params = new URLSearchParams(query)
    uri = `${apiPrefix}/${url}?${params}`
  }
  const response = await fetch(uri, {
    method: 'HEAD',
    mode: 'cors',
    credentials: 'include',
    headers: getHeaders()
  })
  return response.status
}

export async function del<I>(url: string, query?: I): Promise<void> {
  let uri = `${apiPrefix}/${url}`
  if (query) {
    // removes all the undefined
    const params = new URLSearchParams(JSON.parse(JSON.stringify(query)))
    uri = `${apiPrefix}/${url}?${params}`
  }
  const response = await fetch(uri, {
    method: 'DELETE',
    mode: 'cors',
    credentials: 'include',
    headers: getHeaders()
  })
  if (response.status > 400) {
    throw 'Didnt happen'
  }
}

export const eventSource = <T>(topic: string, callback: (data: T) => void) => {
  const events = new EventSource(`${apiPrefix}/v1/stream/${topic}`, {
    withCredentials: true,
  })
  events.onmessage = (event) => {
    const parsedData = JSON.parse(event.data)
    callback(parsedData)
  }
  return () => events.close()
}