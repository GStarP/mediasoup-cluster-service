import { createLogger } from '@/common/logger';
import { MQContext } from '../types';
import type { RPCServerMethods, RPCReq } from './types';
import { rpcTimeout, rpcFail } from './utils';
import { toErrString } from '@/common/utils';

const logger = createLogger(__filename);

export class RPCClient {
  ready = false;

  private _ctx: MQContext;
  private _replyQueue = '';
  private _nextCorrID = 0;
  private _promiseMap = new Map<string, PromiseExec>();
  private _timerMap = new Map<string, ReturnType<typeof setTimeout>>();
  private _consumerTag: string | null = null;

  constructor(ctx: MQContext) {
    this._ctx = ctx;
  }

  static async init(ctx: MQContext): Promise<RPCClient> {
    const client = new RPCClient(ctx);
    await client._init();
    return client;
  }

  private async _init() {
    const channel = this._ctx.channel;
    if (channel === null) {
      throw new Error('channel is null');
    }

    const { queue } = await channel.assertQueue('', {
      durable: false,
      autoDelete: true,
    });
    this._replyQueue = queue;
    logger.info(`queue: ${this._replyQueue}`);

    const { consumerTag } = await channel.consume(this._replyQueue, (msg) => {
      try {
        if (msg === null) {
          logger.error('msg: null');
        } else {
          const corrID = msg.properties.correlationId;
          if (!corrID) {
            logger.error('no corrID');
            return;
          }
          const pe = this._promiseMap.get(corrID);
          if (pe) {
            const timeout = this._timerMap.get(corrID);
            if (timeout) clearTimeout(timeout);

            this._promiseMap.delete(corrID);

            const res = JSON.parse(msg.content.toString());
            logger.debug(`res: ${msg.content.toString()}`);

            pe.resolve(res);
          } else {
            logger.warn(`late reply: ${corrID}`);
          }
        }
      } catch (e) {
        logger.error(`consume: ${toErrString(e)}`);
      }
    });
    this._consumerTag = consumerTag;

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
    const channel = this._ctx.channel;
    if (channel === null) {
      throw new Error('channel is null');
    }

    if (!this.ready) {
      throw new Error('not ready');
    }

    const corrID = this._nextCorrID.toString();
    logger.debug(
      `req: corrID=${corrID} target=${target} method=${method} args=${args}`,
    );

    const promise = new Promise<ReturnType<M[typeof target]>>(
      (resolve, reject) => {
        // save resolve&reject for async return
        this._promiseMap.set(corrID, { resolve, reject });

        // request timeout timer
        this._timerMap.set(
          corrID,
          setTimeout(() => {
            const pe = this._promiseMap.get(corrID);
            this._promiseMap.delete(corrID);
            this._timerMap.delete(corrID);
            if (pe) {
              logger.warn('req timeout');
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
          replyTo: this._replyQueue,
        });
        // TODO: 65536 is an arbitary value
        this._nextCorrID = (this._nextCorrID + 1) % 65536;
      },
    );
    return promise;
  }

  async close() {
    this.ready = false;
    try {
      // reject all promises
      for (const pe of this._promiseMap.values()) {
        pe.reject(rpcFail('close'));
      }
      this._promiseMap.clear();
      // clear all timers
      for (const timer of this._timerMap.values()) {
        clearTimeout(timer);
      }
      this._timerMap.clear();
      // stop consuming
      const channel = this._ctx.channel;
      if (channel && this._consumerTag) {
        await channel.cancel(this._consumerTag);
      }
    } catch (e) {
      logger.error(`close: ${toErrString(e)}`);
    }
  }
}

type PromiseExec = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (value: any) => void;
  reject: (reason?: unknown) => void;
};
