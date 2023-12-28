// ! should share between portal(server) and sdk(client)
import { WORKER_TYPE } from '@/media/index.type';

export enum PortalReqType {
  ALLOC_MEDIA = 'ALLOC_MEDIA',
}
export type PortalRes<R> =
  | {
      code: 0;
      data: R;
    }
  | {
      code: 1;
      data: string;
    };
export type PortalReqList = {
  [PortalReqType.ALLOC_MEDIA]: {
    type: WORKER_TYPE;
  };
};
export type PortalResList = {
  [PortalReqType.ALLOC_MEDIA]: {
    type: WORKER_TYPE;
  };
};

export enum PortalNotType {}
