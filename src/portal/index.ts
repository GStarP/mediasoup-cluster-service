import { v4 } from 'uuid';
import { createLogger } from '@/common/logger';
import { Server } from 'socket.io';
import config from './config.json';
import { PortalReqList, PortalReqType, ReqPayload } from './portal.type';
import { verify } from 'jsonwebtoken';
import { GoraToken } from './index.type';
import MQManager from '@/common/mq';
import { MediaAgentPRCMethods } from '@/media/rpc.type';

async function runPortal() {
  const uuid = `portal@${v4()}`;
  const logger = createLogger(uuid);

  /**
   * MQ
   */
  const mqManager = await MQManager.init(config.mq);
  const rpcClient = await mqManager.rpcClient();

  /**
   * WS
   */
  const io = new Server();
  io.on('connection', (socket) => {
    const token = socket.handshake.headers['token'];
    if (typeof token !== 'string') {
      socket.disconnect(true);
      logger.info(`missing token: ${token}`);
      return;
    }
    try {
      const payload = verify(token, 'dev') as GoraToken;
      socket.data['goraId'] = payload.goraId;
      logger.info(`socket connected: goraId=${payload.goraId}`);
    } catch (e) {
      socket.disconnect(true);
      logger.info(`invalid token: ${token}`);
    }
  });
  io.listen(config.port);

  io.on(
    PortalReqType.ALLOC_MEDIA,
    async (data: PortalReqList[PortalReqType.ALLOC_MEDIA], cb) => {
      // TODO: call cluster manager to allocate router
    },
  );
}

runPortal();
