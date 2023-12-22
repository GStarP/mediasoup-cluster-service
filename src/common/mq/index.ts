import { connect } from 'amqplib';
import type { Channel, Connection } from 'amqplib';
import { RPCClient, RPCServer } from './rpc';
import type { RPCServerMethods } from './rpc';
import { TopicClient } from './topic';

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
  private topicClient: TopicClient | null = null;

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

  async initRPCServer<T extends RPCServerMethods>(
    name: string,
    methods: T,
  ): Promise<RPCServer> {
    this.rpcServer = new RPCServer(name, this);
    await this.rpcServer.init(methods);
    return this.rpcServer;
  }

  async initTopicClient() {
    this.topicClient = new TopicClient(this);
    await this.topicClient.init();
    return this.topicClient;
  }
}

export default MQManager;
