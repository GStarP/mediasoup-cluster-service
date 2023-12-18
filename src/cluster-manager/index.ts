import MQManager from '@/common/mq';
import config from './config.json';
import type { ClusterMangerPRCMethods } from './rpc';

export class ClusterManager {
  static rpcServerName = 'rpc.cm';

  async init() {
    const mqManager = new MQManager(config.mq);
    await mqManager.connect();
    await mqManager.initRPCServer<ClusterMangerPRCMethods>(
      ClusterManager.rpcServerName,
      {
        // TODO: portal uses load-balancing, not clustering
        allocPortal: async () => ({ code: 0, data: '127.0.0.1:8080' }),
      },
    );
  }
}

new ClusterManager().init();
