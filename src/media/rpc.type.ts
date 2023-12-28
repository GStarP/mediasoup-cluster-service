import { RPCRes } from '@/common/mq/rpc/types';
import { RtpCapabilities } from 'mediasoup/node/lib/RtpParameters';

export type MediaAgentPRCMethods = {
  getRouterCapabilities: (routerId: string) => Promise<RPCRes<RtpCapabilities>>;
};
