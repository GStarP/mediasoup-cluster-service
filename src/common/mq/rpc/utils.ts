import { RPCRes } from './types';

export function rpcSuccess<R>(data: R): RPCRes<R> {
  return { code: 0, data };
}
export function rpcFail(msg: string): RPCRes {
  return { code: 1, data: msg };
}
export function rpcTimeout(): RPCRes {
  return { code: 2 };
}
export function rpcInvalidMethod(): RPCRes {
  return { code: 3 };
}
