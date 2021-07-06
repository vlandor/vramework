import { CoreConfig } from './config'
import { Logger as PinoLogger } from 'pino'
import { CoreUserSession } from './user-session'

export interface JWTService<UserSession = CoreUserSession> {
  getJWTSecret: Function
  decodeSessionAsync: (jwtToken: string, debug?: any) => Promise<UserSession>
}

export interface SessionService<UserSession = CoreUserSession> {
  getUserSession: (credentialsRequired: boolean, headers: Partial<Record<'cookie' | 'authorization' | 'apiKey', string | undefined>>, debug?: any) => Promise<UserSession | undefined>
  getCookieName: (headers: Record<string, string>) => string
}

export interface CoreServices extends CoreSingletonServices {
}


export interface CoreSingletonServices {
  config: CoreConfig
  logger: PinoLogger
  jwt: JWTService
  sessionService: SessionService
  createSessionServices: (services: CoreSingletonServices, headers: Record<string, any>, session?: CoreUserSession) => CoreServices
}
