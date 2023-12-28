import { Consumer } from 'mediasoup/node/lib/Consumer';
import { Producer } from 'mediasoup/node/lib/Producer';
import { Router } from 'mediasoup/node/lib/Router';
import { WebRtcTransport } from 'mediasoup/node/lib/WebRtcTransport';
import { Worker } from 'mediasoup/node/lib/Worker';

export type MediaAgentConfig = {
  producerWorkerNum: number;
};

export enum WORKER_TYPE {
  PRODUCER,
  CONSUMER,
}

export type WorkerAppData = {
  router?: Router;
  transports: Map<string, WebRtcTransport>;
} & (
  | {
      type: WORKER_TYPE.PRODUCER;
      producers: Map<string, Producer>;
    }
  | { type: WORKER_TYPE.CONSUMER; consumers: Map<string, Consumer> }
);

export type RouterAppData = {
  worker: Worker<WorkerAppData>;
};
