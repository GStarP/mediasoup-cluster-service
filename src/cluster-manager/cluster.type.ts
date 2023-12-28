import { WORKER_TYPE } from '@/media/index.type';

export type MediaAgentLoad = {
  name: string; // rpc server name
  sys: SystemLoad;
  workers: MediaWorkerLoad[];
};

export type SystemLoad = {
  cpu: number; // usage percentage (0~1)
  mem: number; // usage percentage
};

export type MediaWorkerLoad = {
  routerId: string;
  type: WORKER_TYPE;
  connNum: number; // transport num
  itemNum: number; // producer/consumer num
};

export type MediaWorker = {
  name: string;
  routerId: string;
};
