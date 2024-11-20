import { APIDocs, CoreUserSession } from "./core.types.js"
import { CoreAPIFunctionSessionless } from "./functions.types.js"

/**
 * Represents metadata for scheduled tasks, including title, schedule, and documentation.
 */
export type ScheduledTasksMeta<UserSession extends CoreUserSession = any> = Array<{
    title: string
    schedule: string
    session?: UserSession
    docs?: APIDocs
}>

/**
 * Represents a core scheduled task.
 */
export type CoreScheduledTask<APIFunction extends CoreAPIFunctionSessionless<void, void>, UserSession extends CoreUserSession> = {
    name: string
    schedule: string
    session?: UserSession
    func: APIFunction,
    docs?: APIDocs
}

/**
 * Represents an array of core schedules tasks.
 */
export type CoreScheduledTasks = Array<CoreScheduledTask<CoreAPIFunctionSessionless<void, void>, CoreUserSession>>
