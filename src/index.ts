import { createLogger } from '@/common/logger';

const logger = createLogger(__filename);

const addition = (a: number, b: number): number => {
  return a + b;
};

const number1: number = 5;
const number2: number = 10;
const result: number = addition(number1, number2);

logger.info(`The result is ${result}`);
