import express from 'express'
import * as core from 'express-serve-static-core'
import { Server } from 'http'
import cookieParser from 'cookie-parser'
import * as corsImp from 'cors'
const cors = 'default' in corsImp ? (corsImp.default as any) : corsImp
import { CorsOptions, CorsOptionsDelegate } from 'cors'

import {
  CoreConfig,
  CoreSingletonServices,
  CreateSessionServices,
} from '@vramework/core/types/core.types'
import { vrameworkMiddleware } from '@vramework/express-middleware'

/**
 * Interface for server-specific configuration settings that extend `CoreConfig`.
 */
export type ExpressCoreConfig = CoreConfig & {
  /** The port on which the server should listen. */
  port: number;
  /** The hostname for the server. */
  hostname: string;
  /** The path for health checks (optional). */
  healthCheckPath?: string;
  /** Limits for the server, e.g., memory or request limits (optional). */
  limits?: Partial<Record<string, string>>;
};

export class VrameworkExpressServer {
  public app: core.Express = express()
  private server: Server | undefined

  constructor(
    private readonly config: ExpressCoreConfig,
    private readonly singletonServices: CoreSingletonServices,
    private readonly createSessionServices: CreateSessionServices<any, any, any>
  ) {
    this.app.use(
      express.json({
        limit: this.config.limits?.json || '1mb',
      })
    )

    this.app.use(
      express.text({
        limit: this.config.limits?.xml || '1mb',
        type: 'text/xml',
      })
    )

    this.app.use(
      express.urlencoded({
        extended: true,
        limit: this.config.limits?.urlencoded || '1mb',
      })
    )

    this.app.use(cookieParser())

    this.app.get(
      this.config.healthCheckPath || '/health-check',
      function (req, res) {
        res.status(200).json({ status: 'ok' })
      }
    )
  }

  public enableCors(options: CorsOptions | CorsOptionsDelegate) {
    this.app.use(cors(options))
  }

  public enableStaticAssets(assetsUrl: string, contentDirectory: string) {
    this.app.use(assetsUrl || '/assets/', express.static(contentDirectory))
  }

  public async init() {
    this.app.use(
      vrameworkMiddleware(this.singletonServices, this.createSessionServices, {
        respondWith404: false,
        logRoutes: true,
        loadSchemas: true,
      })
    )
  }

  public async start() {
    return await new Promise<void>((resolve) => {
      this.server = this.app.listen(
        this.config.port,
        this.config.hostname,
        () => {
          this.singletonServices.logger.info(
            `listening on port ${this.config.port} and host: ${this.config.hostname}`
          )
          resolve()
        }
      )
    })
  }

  public async stop(): Promise<void> {
    return await new Promise<void>((resolve) => {
      if (this.server == null) {
        throw 'Unable to stop server as it hasn`t been correctly started'
      }
      this.server.close(() => {
        resolve()
      })
    })
  }

  public async enableExitOnSigInt() {
    process.removeAllListeners('SIGINT').on('SIGINT', async () => {
      this.singletonServices.logger.info('Stopping server...')
      await this.stop()
      this.singletonServices.logger.info('Server stopped')
      process.exit(0)
    })
  }
}
