import { TopicClient } from '@/common/mq/topic';
import { currentLoad, mem } from 'systeminformation';
import { numberReserve } from '@/common/utils';

export class ClusterWorker {
  static TOPIC = 'cluster.worker';

  topClient: TopicClient;

  constructor(topicClient: TopicClient) {
    this.topClient = topicClient;
  }

  joinCluster() {
    setInterval(() => {
      this.reportLoad();
    }, 3000);
  }

  async reportLoad() {
    const { currentLoad: cpu } = await currentLoad();
    const { total, used } = await mem();
    const load: WorkerLoad = {
      cpu: numberReserve(cpu * 100, 2),
      mem: numberReserve((used / total) * 100, 2),
    };
    this.topClient.pub(ClusterWorker.TOPIC, {
      type: 'load',
      data: load,
    });
  }
}

export type WorkerLoad = {
  cpu: number;
  mem: number;
};
