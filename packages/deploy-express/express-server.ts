import express, { NextFunction, Request, Response } from 'express'
import { Server } from 'http'
import { json, text } from 'body-parser'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import { UnauthorizedError } from 'express-jwt'
import cors from 'cors'
import getRawBody from 'raw-body'
import contentType from 'content-type'
import { mkdir, writeFile } from 'fs/promises'
import { v4 as uuid } from 'uuid'

import { CoreConfig, CoreSingletonServices, CoreUserSession, CreateHTTPSessionServices, SessionService, VrameworkConfig } from '@vramework/core/types'
import { getErrorResponse, MissingSessionError } from '@vramework/core/errors'
import { loadSchema, validateJson } from '@vramework/core/schema'
import { initializeVrameworkCore } from '@vramework/core/initialize'
import { verifyPermissions } from '@vramework/core/permissions'

const autMiddleware = (credentialsRequired: boolean, sessionService: SessionService) => (req: Request, res: Response, next: NextFunction) => {
  sessionService.getUserSession(credentialsRequired, req.headers).then((session) => {
    (req as any).auth = session
    next()
  }).catch((e) => {
    if (credentialsRequired) {
      next(new MissingSessionError())
    } else {
      next()
    }
  })
}

export class ExpressServer {
  public app = express()
  private server: Server | undefined

  constructor(
    private readonly vrameworkConfig: VrameworkConfig,
    private readonly config: CoreConfig,
    private readonly singletonServices: CoreSingletonServices,
    private readonly createHTTPSessionServices: CreateHTTPSessionServices,
  ) {}

  public async init() {
    const { routes } = await initializeVrameworkCore(this.vrameworkConfig)
    const uploadFilePath: string | undefined = (this.config as any).content?.localFileUploadPath

    this.app.use(
      json({
        limit: '1mb',
      }),
    )
    this.app.use(
      text({
        limit: '1mb',
        type: 'text/xml'
      }),
    )
    this.app.use(bodyParser.urlencoded({ extended: true }))
    this.app.use(cookieParser())
    this.app.use(
      cors({
        origin: /http:\/\/localhost:\d\d\d\d/,
        credentials: true,
      }),
    )

    this.app.get('/v1/health-check', function (req, res) {
      res.status(200).end()
    })

    this.app.get(`/v1/logout`, (req, res) => {
      res.clearCookie(this.singletonServices.sessionService.getCookieName(req.headers as Record<string, string>))
      res.end()
    })

    if (uploadFilePath) {
      this.app.use('/assets/', express.static(uploadFilePath))

      this.app.put(`/v1/reaper/*`,
        autMiddleware(true, this.singletonServices.sessionService),
        async (req, res) => {
          const file = await getRawBody(req, {
            length: req.headers['content-length'],
            limit: '10mb',
            encoding: contentType.parse(req).parameters.charset,
          })

          const key = req.path.replace('/v1/reaper/', '')
          const parts = key.split('/')
          const fileName = parts.pop()
          const dir = `${uploadFilePath}/${parts.join('/')}`

          await mkdir(dir, { recursive: true })
          await writeFile(`${dir}/${fileName}`, file, 'binary')
          res.end()
        },
      )
    }

    routes.forEach((route) => {
      if (route.schema) {
        loadSchema(route.schema, this.singletonServices.logger)
      }

      const path = `/${route.route}`
      this.singletonServices.logger.debug(`Adding ${route.type.toUpperCase()} with route ${path}`)
      this.app[route.type](
        path,
        autMiddleware(route.requiresSession !== false, this.singletonServices.sessionService),
        async (req, res, next) => {
          try {
            const session = (req as any).auth as CoreUserSession | undefined

            res.locals.cookiename = this.singletonServices.sessionService.getCookieName(req.headers as Record<string, string>)
            res.locals.processed = true

            const isXML = req.headers['content-type']?.includes('text/xml')

            let data: any
            if (isXML) {
              data = req.body
            } else {
              data = { ...req.params, ...req.query, ...req.body }
              if (route.schema) {
                validateJson(route.schema, data)
              }
            }

            const sessionServices = await this.createHTTPSessionServices(this.singletonServices, session, { req, res })
            try {
              if (route.permissions) {
                await verifyPermissions(route.permissions, sessionServices, data, session)
              }
              res.locals.result = await route.func(sessionServices, data, session)
            } catch (e: any) {
              throw e
            } finally {
              for (const service of Object.values(sessionServices)) {
                if (service.closeSession) {
                  await service.closeSession()
                }
              }
            }
            next()
          } catch (e: any) {
            next(e)
          }
        },
      )
    })

    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!error) {
        return next()
      }

      if (error instanceof UnauthorizedError) {
        this.singletonServices.logger.error('JWT AUTH ERROR', error)
        res.status(401).end()
        return
      }

      const errorDetails = getErrorResponse(error)

      if (errorDetails != null) {
        const errorId = (error as any).errorId || uuid()
        console.error(errorId, error)
        res.status(errorDetails.status).json({ message: errorDetails.message, errorId, payload: (error as any).payload })
      } else {
        const errorId = uuid()
        console.error(errorId, error)
        res.status(500).json({ errorId })
      }
    })

    this.app.use((req, res) => {
      if (res.locals.processed !== true) {
        res.status(404).end()
        return
      }
      if (res.locals.result) {
        if (res.locals.result.jwt) {
          res.cookie(res.locals.cookiename, res.locals.result.jwt, {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            // secure: true,
            // sameSite: 'none'
            // domain: req.headers.origin,
          })
        }

        if (res.locals.returnsJSON === false) {
          res.send(res.locals.result).end()
        } else {
          res.json(res.locals.result).end()
        }
      } else {
        res.status(200).end()
      }
    })
  }

  public async start() {
    return await new Promise<void>((resolve) => {
      this.server = this.app.listen(this.config.server.port, () => {
        this.singletonServices.logger.info(`listening on port ${this.config.server.port}`)
        resolve()
      })
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
}
