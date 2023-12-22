import MQManager from '@/common/mq';
import config from './config.json';
import type { ClusterMangerPRCMethods } from './rpc';
import { ClusterWorker, WorkerLoad } from '@/common/cluster/worker';
import { createLogger } from '@/common/logger';

const logger = createLogger(__filename);

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

    const topicClient = await mqManager.initTopicClient();
    await topicClient.sub<WorkerLoad>(ClusterWorker.TOPIC, 'load', (msg) => {
      const load = msg.data;
      logger.debug(`worker load: cpu=${load.cpu}%, mem=${load.mem}%`);
    });
    await topicClient.start();
  }
}

new ClusterManager().init();
