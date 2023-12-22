export type RPCReq = {
  method: string;
  args: unknown[];
};

export type RPCRes<R = unknown> =
  | {
      code: 0;
      data: R;
    }
  | {
      code: 1;
      data: string;
    }
  | { code: 2 } // timeout error
  | { code: 3 }; // method not allow

export type RPCServerMethods = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: (...args: any[]) => Promise<RPCRes<any>>;
};
