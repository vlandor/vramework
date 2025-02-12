import { Logger } from '../services/index.js'
import { getScheduledTasks } from './scheduler-runner.js'

/**
 * Logs all the loaded scheduled tasks.
 * @param logger - A logger for logging information.
 */
export const logSchedulers = (logger: Logger) => {
  const { scheduledTasks } = getScheduledTasks()
  if (scheduledTasks.size === 0) {
    logger.info('No scheduled tasks added')
    return
  }

  let scheduledTasksMessage = 'Scheduled tasks:'
  scheduledTasks.forEach(({ schedule }, name) => {
    scheduledTasksMessage += `\n\t- ${name} -> ${schedule}`
  })
  logger.info(scheduledTasksMessage)
}
