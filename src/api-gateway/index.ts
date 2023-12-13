import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { createLogger } from '@/common/logger';
import config from './config.json';
import MQManager from '@/common/mq';
import { sign } from 'jsonwebtoken';

const logger = createLogger(__filename);

class APIGateway {
  server: express.Express;

  constructor() {
    this.server = express();
  }

  async init() {
    this.server.use(cors());

    const mqManager = new MQManager(config.mq);
    await mqManager.connect();
    const rpcClient = await mqManager.initRPCClient();

    this.server.post('/token', async (req, res) => {
      const portalRes = await rpcClient.request<string>(
        'rpc.clusterManager',
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
    const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
      logger.error(err);
      res.status(500).send('Something broke!');
      next(err);
    };
    this.server.use(errorHandler);

    this.server.listen(config.port, () => {
      logger.info(`api-gateway listening on ${config.port}`);
    });
  }
}

new APIGateway().init();
