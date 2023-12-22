import type { RPCRes } from '@/common/mq/rpc/types';

export type ClusterMangerPRCMethods = {
  allocPortal: () => Promise<RPCRes<string>>;
};
