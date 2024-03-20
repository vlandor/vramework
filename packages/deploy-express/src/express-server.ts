import express, { NextFunction, Request, Response } from 'express'
import { Server } from 'http'
import { json, text } from 'body-parser'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import { UnauthorizedError } from 'express-jwt'
import cors from 'cors'
import getRawBody from 'raw-body'
import contentType from 'content-type'

import { getErrorResponse, MissingSessionError } from '@vramework/core/dist/errors'
import { CoreAPIRoutes } from '@vramework/core/dist/routes'
import { CoreConfig } from '@vramework/core/dist/config'
import { CoreSingletonServices, SessionService } from '@vramework/core/dist/services'
import { loadSchema, validateJson } from '@vramework/core/dist/schema'
import { CoreUserSession } from '@vramework/core/dist/user-session'
import { verifyPermissions } from '@vramework/core/dist/permissions'
import { mkdir, writeFile } from 'fs/promises'
import { v4 as uuid } from 'uuid'
import { LocalContent } from '@vramework/core/dist/services/local-content'

const authMiddleware = (credentialsRequired: boolean, sessionService: SessionService) => (req: Request, res: Response, next: NextFunction) => {
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
  public app: express.Application = express()
  private server: Server | undefined

  constructor(
    private readonly config: CoreConfig,
    private readonly services: CoreSingletonServices,
    private readonly routes: CoreAPIRoutes,
  ) { }

  public async init() {
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
    this.app.use(cookieParser() as express.RequestHandler)
    this.app.use(
      cors({
        origin: /http:\/\/localhost:\d\d\d\d/,
        credentials: true,
      }),
    )

    if (this.services.content instanceof LocalContent) {
      const contentConfig = this.config.content
      if (!contentConfig) {
        this.services.logger.error('No content config found')
        process.exit(1)
      }

      this.app.use('/assets/', express.static(contentConfig.fileUploadPath))
      this.app.put(`/v1/reaper/*`,
        authMiddleware(true, this.services.sessionService),
        async (req, res) => {
          const file = await getRawBody(req, {
            length: req.headers['content-length'],
            limit: contentConfig.fileSizeLimit,
            encoding: contentType.parse(req).parameters.charset,
          })

          const key = req.path.replace('/v1/reaper/', '')
          const parts = key.split('/')
          const fileName = parts.pop()

          const dir = `${contentConfig.fileUploadPath}/${parts.join('/')}`
          await mkdir(dir, { recursive: true })
          await writeFile(`${dir}/${fileName}`, file, 'binary')
          res.end()
        },
      )
    }


    this.app.get('/v1/health-check', function (req, res) {
      res.status(200).end()
    })

    this.app.get(`/v1/logout`, (req, res) => {
      res.clearCookie(this.services.sessionService.getCookieName(req.headers as Record<string, string>))
      res.end()
    })

    this.routes.forEach((route) => {
      if (route.schema) {
        loadSchema(route.schema, this.services.logger)
      }

      const path = `/${route.route}`
      this.services.logger.debug(`Adding ${route.type.toUpperCase()} with route ${path}`)
      this.app[route.type](
        path,
        authMiddleware(route.requiresSession !== false, this.services.sessionService),
        async (req, res, next) => {
          try {
            const session = (req as any).auth as CoreUserSession | undefined

            res.locals.cookiename = this.services.sessionService.getCookieName(req.headers as Record<string, string>)
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

            const sessionServices = await this.services.createSessionServices(this.services, req.headers, session)
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
        this.services.logger.error('JWT AUTH ERROR', error)
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
        this.services.logger.info(`listening on port ${this.config.server.port}`)
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

export default ExpressServer
