import { createLogger } from '@/common/logger';
import { MQContext } from './types';
import { toErrString } from '@/common/error';

const logger = createLogger(__filename);

export class RPCClient {
  ctx: MQContext;
  ready = false;
  replyQueue = '';
  nextCorrID = 0;
  promiseMap = new Map<string, PromiseExec>();
  timerMap = new Map<string, ReturnType<typeof setTimeout>>();
  consumerTag: string | null = null;

  constructor(ctx: MQContext) {
    this.ctx = ctx;
  }

  async init() {
    const channel = this.ctx.channel;
    if (channel === null) {
      throw new Error('channel is null');
    }

    const { queue } = await channel.assertQueue('', {
      durable: false,
      autoDelete: true,
    });
    this.replyQueue = queue;
    logger.info(`rpc-client queue: ${this.replyQueue}`);

    const { consumerTag } = await channel.consume(this.replyQueue, (msg) => {
      try {
        if (msg === null) {
          logger.error('rpc-client msg: null');
        } else {
          const corrID = msg.properties.correlationId;
          if (!corrID) {
            logger.error('rpc-client no corrID');
            return;
          }
          const pe = this.promiseMap.get(corrID);
          if (pe) {
            const timeout = this.timerMap.get(corrID);
            if (timeout) clearTimeout(timeout);

            this.promiseMap.delete(corrID);

            const res = JSON.parse(msg.content.toString());
            logger.debug(`rpc-client res: ${msg.content.toString()}`);

            pe.resolve(res);
          } else {
            logger.warn(`rpc-client late reply: ${corrID}`);
          }
        }
      } catch (e) {
        logger.error(`rpc-client consume: ${e}`);
      }
    });
    this.consumerTag = consumerTag;

    this.ready = true;
  }

  /**
   * @param target target queue name
   * @param method rpc method name
   * @param args rpc method args
   * @param timeout rpc request timeout
   * @returns response
   */
  async request<M extends RPCServerMethods>(
    target: string,
    method: Extract<keyof M, string>,
    args: unknown[],
    timeout = 10 * 1000,
  ): Promise<ReturnType<M[typeof method]>> {
    const channel = this.ctx.channel;
    if (channel === null) {
      throw new Error('channel is null');
    }

    if (!this.ready) {
      throw new Error('rpc-client not ready');
    }

    const corrID = this.nextCorrID.toString();
    logger.debug(
      `rpc-client req: corrID=${corrID} target=${target} method=${method} args=${args}`,
    );

    const promise = new Promise<ReturnType<M[typeof target]>>(
      (resolve, reject) => {
        // save resolve&reject for async return
        this.promiseMap.set(corrID, { resolve, reject });

        // request timeout timer
        this.timerMap.set(
          corrID,
          setTimeout(() => {
            const pe = this.promiseMap.get(corrID);
            this.promiseMap.delete(corrID);
            this.timerMap.delete(corrID);
            if (pe) {
              logger.warn('rpc-client req timeout');
              pe.reject(rpcTimeout());
            }
          }, timeout),
        );

        const req: RPCReq = {
          method: method.toString(),
          args,
        };

        const content = JSON.stringify(req);
        channel.sendToQueue(target, Buffer.from(content), {
          correlationId: corrID,
          replyTo: this.replyQueue,
        });
        // TODO: 65536 is an arbitary value
        this.nextCorrID = (this.nextCorrID + 1) % 65536;
      },
    );
    return promise;
  }

  async close() {
    try {
      // reject all promises
      for (const pe of this.promiseMap.values()) {
        pe.reject(rpcFail('rpc-client close'));
      }
      this.promiseMap.clear();
      // clear all timers
      for (const timer of this.timerMap.values()) {
        clearTimeout(timer);
      }
      this.timerMap.clear();
      // stop consuming
      const channel = this.ctx.channel;
      if (channel && this.consumerTag) {
        await channel.cancel(this.consumerTag);
      }
    } catch (e) {
      // TODO: will lose stack info
      logger.error(`rpc-client close: ${e}`);
    }
  }
}

export class RPCServer {
  ctx: MQContext;
  name: string;
  ready = false;

  consumerTag: string | null = null;

  constructor(name: string, ctx: MQContext) {
    this.name = name;
    this.ctx = ctx;
  }

  async init(methods: RPCServerMethods) {
    const channel = this.ctx.channel;
    if (channel === null) {
      throw new Error('channel is null');
    }

    await channel.assertQueue(this.name, {
      durable: false,
      autoDelete: true,
    });
    logger.info(`rpc-server queue: ${this.name}`);

    const { consumerTag } = await channel.consume(this.name, async (msg) => {
      try {
        if (msg === null) {
          logger.warn('rpc-server msg: null');
        } else {
          // check corrID
          const corrID = msg.properties.correlationId;
          if (!corrID) {
            logger.warn(`rpc-server no corrID`);
            return;
          }
          // check replyQueue
          const replyQueue = msg.properties.replyTo;
          if (!replyQueue) {
            logger.warn(`rpc-server no replyQueue`);
            return;
          }
          const req = JSON.parse(msg.content.toString()) as RPCReq;
          const methodFunc = methods[req.method];
          const curChannel = this.ctx.channel;
          if (curChannel === null) {
            logger.warn(`rpc-server channel becomes null`);
            return;
          }
          if (!methodFunc) {
            logger.error(`rpc-server no method: ${req.method}`);
            const res = rpcInvalidMethod();
            curChannel.sendToQueue(
              replyQueue,
              Buffer.from(JSON.stringify(res)),
              { correlationId: corrID },
            );
            return;
          }
          // execute method
          try {
            const res = await methodFunc(...req.args);
            curChannel.sendToQueue(
              replyQueue,
              Buffer.from(JSON.stringify(res)),
              { correlationId: corrID },
            );
          } catch (e) {
            logger.error(`rpc-server exec method: ${e}`);
            const res = rpcFail(toErrString(e));
            curChannel.sendToQueue(
              replyQueue,
              Buffer.from(JSON.stringify(res)),
              { correlationId: corrID },
            );
          }
        }
      } catch (e) {
        logger.error(`rpc-server consume: ${e}`);
      }
    });
    this.consumerTag = consumerTag;
  }

  async close() {
    try {
      const channel = this.ctx.channel;
      // stop consuming
      if (channel && this.consumerTag) {
        await channel.cancel(this.consumerTag);
      }
    } catch (e) {
      logger.error(`rpc-server close: ${e}`);
    }
  }
}

///////////
// Types //
///////////

type PromiseExec = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (value: any) => void;
  reject: (reason?: unknown) => void;
};

export type RPCReq = {
  method: string;
  args: unknown[];
};

export type RPCRes<R = unknown> =
  | {
      code: 0;
      data: R;
    }
  | {
      code: 1;
      data: string;
    }
  | { code: 2 } // timeout error
  | { code: 3 }; // method not allow

export type RPCServerMethods = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: (...args: any[]) => Promise<RPCRes<any>>;
};

///////////
// Utils //
///////////

export function rpcSuccess<R>(data: R): RPCRes<R> {
  return { code: 0, data };
}
export function rpcFail(msg: string): RPCRes {
  return { code: 1, data: msg };
}
export function rpcTimeout(): RPCRes {
  return { code: 2 };
}
export function rpcInvalidMethod(): RPCRes {
  return { code: 3 };
}
