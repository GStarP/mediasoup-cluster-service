import type { RPCRes } from '@/common/mq/rpc/types';
import { MediaWorker } from './cluster.type';
import { WORKER_TYPE } from '@/media/index.type';

export const CLUSTER_MANAGER_RPC_SERVER_NAME = 'rpc.cm';

export type ClusterMangerPRCMethods = {
  allocMedia: (uid: string, type: WORKER_TYPE) => Promise<RPCRes<MediaWorker>>;
};
