import { currentLoad, mem } from 'systeminformation';
import { numberReserve } from '@/common/utils';
import { TopicClient } from '@/common/mq/topic';
import { WorkerLoad } from './types';

export class ClusterWorker {
  static TOPIC = 'cluster.worker';

  private _topClient: TopicClient;

  constructor(topicClient: TopicClient) {
    this._topClient = topicClient;
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
    this._topClient.pub(ClusterWorker.TOPIC, {
      type: 'load',
      data: load,
    });
  }
}
