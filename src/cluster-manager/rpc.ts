import { RPCRes } from '@/common/mq/rpc';

export type ClusterMangerPRCMethods = {
  allocPortal: () => Promise<RPCRes<string>>;
};
