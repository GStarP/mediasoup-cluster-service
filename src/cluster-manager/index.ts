import type { WorkerLoad } from '@/common/cluster/types';
import MQManager from '@/common/mq';
import config from './config.json';
import type { ClusterMangerPRCMethods } from './rpc';
import { ClusterWorker } from '@/common/cluster/worker';
import { createLogger } from '@/common/logger';

const logger = createLogger(__filename);

export class ClusterManager {
  static rpcServerName = 'rpc.cm';

  async init() {
    const mqManager = await MQManager.init(config.mq);
    await mqManager.rpcServer<ClusterMangerPRCMethods>(
      ClusterManager.rpcServerName,
      {
        // TODO: portal uses load-balancing, not clustering
        allocPortal: async () => ({ code: 0, data: '127.0.0.1:8080' }),
      },
    );

    const topicClient = await mqManager.topicClient();
    await topicClient.sub<WorkerLoad>(ClusterWorker.TOPIC, 'load', (load) => {
      logger.debug(`worker load: cpu=${load.cpu}%, mem=${load.mem}%`);
    });
    await topicClient.start();
  }
}

new ClusterManager().init();
