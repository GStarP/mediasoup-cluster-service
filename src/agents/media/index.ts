import MQManager from '@/common/mq';
import config from './config.json';
import { ClusterWorker } from '@/common/cluster/worker';

class MediaAgent {
  async init() {
    const mqManager = new MQManager(config.mq);
    await mqManager.connect();
    const topicClient = await mqManager.initTopicClient();
    const clusterWorker = new ClusterWorker(topicClient);
    clusterWorker.joinCluster();
  }
}

new MediaAgent().init();
