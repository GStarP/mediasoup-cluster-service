import { Channel, Connection, connect } from 'amqplib';
import { RPCClient, RPCServer, RPCServerMethods } from './rpc';

interface MQConfig {
  url: string;
  username?: string;
  password?: string;
}

class MQManager {
  config: MQConfig;
  // mq basic
  connection: Connection | null = null;
  channel: Channel | null = null;
  // mq class
  private rpcClient: RPCClient | null = null;
  private rpcServer: RPCServer | null = null;

  constructor(config: MQConfig) {
    this.config = config;
  }

  async connect() {
    this.connection = await connect(this.config);
    this.channel = await this.connection.createChannel();
  }

  async initRPCClient(): Promise<RPCClient> {
    this.rpcClient = new RPCClient(this);
    await this.rpcClient.init();
    return this.rpcClient;
  }

  async initRPCServer(
    name: string,
    methods: RPCServerMethods,
  ): Promise<RPCServer> {
    this.rpcServer = new RPCServer(name, this);
    await this.rpcServer.init(methods);
    return this.rpcServer;
  }
}

export default MQManager;
