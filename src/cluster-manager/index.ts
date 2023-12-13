import MQManager from '@/common/mq';
import config from './config.json';

class ClusterManager {
  async init() {
    const mqManager = new MQManager(config.mq);
    await mqManager.connect();
    await mqManager.initRPCServer('rpc.clusterManager', {
      // TODO: mock
      allocPortal: async () => ({ code: 0, data: '1.1.1.1' }),
    });
  }
}

new ClusterManager().init();
