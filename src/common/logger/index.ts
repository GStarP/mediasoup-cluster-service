import {
  createLogger as createWinstonLogger,
  format,
  transports,
} from 'winston';
import { IS_DEV } from '@/common/const';

const logger = createWinstonLogger({
  // basic info: level + message + timestamp
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json(),
  ),
});

if (IS_DEV) {
  logger.add(
    new transports.Console({
      format: format.combine(
        // set log.level to upper-case
        format((log) => {
          log.level = log.level.toUpperCase();
          return log;
        })(),
        // then append color unicode string to log.level
        format.colorize(),
        format.align(),
        format.printf(
          (log) =>
            `[${log.timestamp}][${log.level}][${log.tag ?? 'global'}] ${
              log.message
            }`,
        ),
      ),
    }),
  );
}

export function createLogger(tag: string) {
  return logger.child({
    tag,
  });
}
