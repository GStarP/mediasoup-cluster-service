import { v4 } from 'uuid';
import MQManager from '@/common/mq';
import config from './config.json';
import { Worker } from 'mediasoup/node/lib/types';
import { createLogger } from '@/common/logger';
import { cpus } from 'os';
import { createWorker, getSupportedRtpCapabilities } from 'mediasoup';
import { RouterAppData, WORKER_TYPE, WorkerAppData } from './index.type';
import { routerOptions } from './options';
import { numberReserve, safeStringify } from '@/common/utils';
import { MediaAgentPRCMethods } from './rpc.type';
import { rpcFail, rpcSuccess } from '@/common/mq/rpc/utils';
import { ClusterWorker } from '@/common/cluster/worker';
import { MediaAgentLoad } from '@/cluster-manager/cluster.type';
import { currentLoad, mem } from 'systeminformation';
import { MEDIA_CLUSTER_NAME } from './cluster.type';

async function runMediaAgent() {
  const uuid = `media@${v4()}`;
  const logger = createLogger(uuid);

  /**
   * Mediasoup
   */
  logger.debug(
    `mediasoup support: ${safeStringify(getSupportedRtpCapabilities())}`,
  );
  // routerId => worker
  const workers: Map<string, Worker<WorkerAppData>> = new Map();
  for (let i = 0; i < cpus().length; i++) {
    // create producer worker first
    const type =
      i < config.producerWorkerNum
        ? WORKER_TYPE.PRODUCER
        : WORKER_TYPE.CONSUMER;

    logger.info(`create worker: index=${i} type=${type}`);
    const worker = await createWorker<WorkerAppData>({
      logLevel: 'debug',
      appData:
        type === WORKER_TYPE.PRODUCER
          ? {
              type,
              transports: new Map(),
              producers: new Map(),
            }
          : {
              type,
              transports: new Map(),
              consumers: new Map(),
            },
    });

    const router = await worker.createRouter<RouterAppData>({
      ...routerOptions,
      appData: {
        // ! all things store in worker, router only hold a reference to worker
        worker,
      },
    });
    worker.appData.router = router;

    workers.set(router.id, worker);
    logger.info(`worker created: id=${worker.appData.router.id}`);
  }

  /**
   * MQ
   */
  const mqManager = await MQManager.init(config.mq);
  await mqManager.rpcServer<MediaAgentPRCMethods>(uuid, {
    getRouterCapabilities: async (routerId: string) => {
      const worker = workers.get(routerId);
      if (!worker) return rpcFail('missing worker');
      if (!worker.appData.router) return rpcFail('missing router');
      return rpcSuccess(worker.appData.router.rtpCapabilities);
    },
  });
  const topicClient = await mqManager.topicClient();

  /**
   * Cluster
   */
  async function getLoad(): Promise<MediaAgentLoad> {
    const { currentLoad: cpu } = await currentLoad();
    const { total, used } = await mem();
    const load: MediaAgentLoad = {
      name: uuid,
      sys: {
        cpu: numberReserve(cpu * 100, 2),
        mem: numberReserve((used / total) * 100, 2),
      },
      workers: [],
    };
    for (const [routerId, worker] of workers) {
      load.workers.push({
        type: worker.appData.type,
        routerId,
        connNum: worker.appData.transports.size,
        itemNum:
          worker.appData.type === WORKER_TYPE.PRODUCER
            ? worker.appData.producers.size
            : worker.appData.consumers.size,
      });
    }

    return load;
  }
  const clusterWorker = new ClusterWorker(
    MEDIA_CLUSTER_NAME,
    topicClient,
    getLoad,
  );
  clusterWorker.joinCluster();
}

runMediaAgent();
