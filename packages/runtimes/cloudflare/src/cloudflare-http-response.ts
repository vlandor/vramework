import { JSONValue } from '@pikku/core'
import { PikkuHTTPAbstractResponse } from '@pikku/core/http/pikku-http-abstract-response'
import { WebSocket } from '@cloudflare/workers-types'

export class CloudfrontHTTPResponse extends PikkuHTTPAbstractResponse {
  public headers: Record<string, string> = {}
  private status: number = 200
  private body: any

  constructor(private websocket?: WebSocket) {
    super()
  }

  public getCloudflareResponse(): Response {
    return new Response(this.body, {
      status: this.status,
      headers: this.headers,
      webSocket: this.status === 101 ? this.websocket : undefined,
    } as any)
  }

  public setStatus(status: number): void {
    this.status = status
  }

  public setHeader(name: string, value: string | boolean | string[]): void {
    this.headers[name] = value.toString()
  }

  public setJson(value: JSONValue): void {
    this.body = JSON.stringify(value)
  }

  public setResponse(response: string): void {
    this.body = response
  }

  public setRedirect(path: string, status: number) {
    throw new Error('Method not implemented.')
  }

  public setWebsocket(websocket: WebSocket) {
    this.websocket = websocket
  }
}
