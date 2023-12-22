import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { createLogger } from '@/common/logger';
import config from './config.json';
import { sign } from 'jsonwebtoken';
import { ClusterManager } from '@/cluster-manager';
import type { ClusterMangerPRCMethods } from '@/cluster-manager/rpc';
import MQManager from '@/common/mq';

const logger = createLogger(__filename);

class APIGateway {
  server: express.Express;

  constructor() {
    this.server = express();
  }

  async init() {
    this.server.use(cors());

    const mqManager = await MQManager.init(config.mq);
    const rpcClient = await mqManager.rpcClient();

    this.server.post('/token', async (_, res) => {
      const portalRes = await rpcClient.request<ClusterMangerPRCMethods>(
        ClusterManager.rpcServerName,
        'allocPortal',
        [],
      );
      if (portalRes.code === 0) {
        const portalIP = portalRes.data;
        const token = sign(
          {
            portal: portalIP,
          },
          'dev',
        );
        res.status(200).end(token);
      } else {
        logger.error(portalRes);
        res.status(500).end();
      }
    });

    // handle all error here
    const errorHandler: ErrorRequestHandler = (err, req, res) => {
      logger.error(err);
      res.status(500).send(err);
    };
    this.server.use(errorHandler);

    this.server.listen(config.port, () => {
      logger.info(`api-gateway listening on ${config.port}`);
    });
  }
}

new APIGateway().init();
