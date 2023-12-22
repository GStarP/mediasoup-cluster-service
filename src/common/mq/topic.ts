import { createLogger } from '@/common/logger';
import { MQContext } from './types';

const logger = createLogger(__filename);

export class TopicClient {
  static TOPIC_EXCHANGE_NAME = 'topic';

  ctx: MQContext;
  ready = false;
  exchange = '';
  queue = '';
  consumerTag = '';
  // msg type => callback
  callbacks = new Map<string, TopicMsgCallback>();
  // TODO: not a elegant impl
  topics = new Set<string>();

  constructor(ctx: MQContext) {
    this.ctx = ctx;
  }

  async init() {
    const channel = this.ctx.channel;
    if (channel === null) {
      throw new Error('channel is null');
    }

    const { exchange } = await channel.assertExchange(
      TopicClient.TOPIC_EXCHANGE_NAME,
      'topic',
      {
        durable: false,
        autoDelete: false,
      },
    );
    this.exchange = exchange;
    logger.info(`exchange: ${this.exchange}`);

    const { queue } = await channel.assertQueue('', {
      durable: false,
      autoDelete: true,
    });
    this.queue = queue;
    logger.info(`queue: ${this.queue}`);

    this.ready = true;
  }

  async start() {
    if (!this.ready) {
      logger.error('not ready');
      return;
    }

    const channel = this.ctx.channel;
    if (channel === null) {
      logger.error('channel is null');
      return;
    }

    if (this.consumerTag !== '') {
      logger.error(`already consuming: consumerTag=${this.consumerTag}`);
      return;
    }

    const { consumerTag } = await channel.consume(
      this.queue,
      (rawMsg) => {
        try {
          if (rawMsg === null) {
            logger.warn('msg: null');
          } else {
            logger.debug(`consume: msg=${rawMsg.content.toString()}`);
            const msg = JSON.parse(rawMsg.content.toString()) as TopicMsg;
            this.callbacks.forEach((cb, type) => {
              if (type === msg.type) {
                cb(msg);
              }
            });
          }
        } catch (e) {
          logger.error(`consume: ${e}`);
        }
      },
      { noAck: true },
    );
    this.consumerTag = consumerTag;
    logger.info(`consume: consumerTag=${consumerTag}`);
  }

  /**
   * @param topic msg sub pattern
   * @param type msg type can process
   * @param callback
   * @returns
   */
  async sub<T>(topic: string, type: string, callback: TopicMsgCallback<T>) {
    if (!this.ready || this.ctx.channel === null) return;

    // call with same params will change nothing in rqbbitmq
    const channel = this.ctx.channel;
    await channel.bindQueue(this.queue, TopicClient.TOPIC_EXCHANGE_NAME, topic);
    logger.info(`bind queue=${this.queue} with routing key=${topic}`);

    if (this.callbacks.has(type)) {
      logger.warn(`previous callback remove: type=${type}`);
    }
    this.callbacks.set(type, callback);
    this.topics.add(topic);
  }

  async pub(topic: string, msg: TopicMsg) {
    logger.debug(`pub: topic=${topic} msg=${JSON.stringify(msg)}`);

    if (this.ctx.channel === null) return;
    const channel = this.ctx.channel;

    try {
      channel.publish(
        TopicClient.TOPIC_EXCHANGE_NAME,
        topic,
        Buffer.from(JSON.stringify(msg)),
      );
    } catch (e) {
      logger.error(`pub: e=${e}`);
    }
  }

  async stop() {
    if (!this.ready || this.ctx.channel === null || this.consumerTag === '')
      return;

    const channel = this.ctx.channel;
    await channel.cancel(this.consumerTag);
  }

  async close() {
    if (!this.ready || this.ctx.channel === null) return;

    const channel = this.ctx.channel;
    this.topics.forEach(
      async (topic) =>
        await channel.unbindQueue(
          this.queue,
          TopicClient.TOPIC_EXCHANGE_NAME,
          topic,
        ),
    );
    await this.stop();
    await channel.deleteQueue(this.queue);
  }
}

///////////
// Types //
///////////
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopicMsg<T = any> = {
  type: string;
  data: T;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TopicMsgCallback<T = any> = (msg: TopicMsg<T>) => void;
