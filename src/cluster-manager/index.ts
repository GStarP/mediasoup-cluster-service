import MQManager from '@/common/mq';
import config from './config.json';
import {
  type ClusterMangerPRCMethods,
  CLUSTER_MANAGER_RPC_SERVER_NAME,
} from './rpc.type';
import { createLogger } from '@/common/logger';
import { rpcFail, rpcSuccess } from '@/common/mq/rpc/utils';
import { MediaAgentLoad } from './cluster.type';
import { MEDIA_CLUSTER_NAME } from '@/media/cluster.type';
import { v4 } from 'uuid';

async function runClusterManager() {
  const uuid = `cluster-manager@${v4()}`;
  const logger = createLogger(uuid);

  // media server name => media server load
  const mediaAgentLoads: Map<string, MediaAgentLoad> = new Map();

  /**
   * MQ
   */
  const mqManager = await MQManager.init(config.mq);
  await mqManager.rpcServer<ClusterMangerPRCMethods>(
    CLUSTER_MANAGER_RPC_SERVER_NAME,
    {
      allocMedia: async (uid, type) => {
        if (mediaAgentLoads.size === 0) {
          return rpcFail('none media agent');
        }
        // TODO: temporarily use the first meida router
        for (const [, load] of mediaAgentLoads) {
          for (const worker of load.workers) {
            if (worker.type === type) {
              logger.info(
                `alloc media: name=${load.name} routerId=${worker.routerId}`,
              );
              return rpcSuccess({
                name: load.name,
                routerId: worker.routerId,
              });
            }
          }
        }

        return rpcFail('no available media agent');
      },
    },
  );

  const topicClient = await mqManager.topicClient();
  await topicClient.sub<MediaAgentLoad>(MEDIA_CLUSTER_NAME, 'load', (load) => {
    mediaAgentLoads.set(load.name, load);
  });
  await topicClient.start();

  logger.info('running');
}

runClusterManager();
