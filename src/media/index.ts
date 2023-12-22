import MQManager from '@/common/mq';
import config from './config.json';
import { ClusterWorker } from '@/common/cluster/worker';

class MediaAgent {
  async init() {
    const mqManager = await MQManager.init(config.mq);
    const topicClient = await mqManager.topicClient();
    const clusterWorker = new ClusterWorker(topicClient);
    clusterWorker.joinCluster();
  }
}

new MediaAgent().init();
