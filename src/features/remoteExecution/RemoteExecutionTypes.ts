import { SlingClient } from 'sling-client';

import { WorkspaceLocation } from '../../commons/workspace/WorkspaceTypes';

export const REMOTE_EXEC_FETCH_DEVICES = 'REMOTE_EXEC_FETCH_DEVICES';
export const REMOTE_EXEC_UPDATE_DEVICES = 'REMOTE_EXEC_UPDATE_DEVICES';
export const REMOTE_EXEC_UPDATE_SESSION = 'REMOTE_EXEC_UPDATE_SESSION';

export const REMOTE_EXEC_CONNECT = 'REMOTE_EXEC_CONNECT';
export const REMOTE_EXEC_DISCONNECT = 'REMOTE_EXEC_DISCONNECT';

export const REMOTE_EXEC_RUN = 'REMOTE_EXEC_RUN';
export const REMOTE_EXEC_REPL_INPUT = 'REMOTE_EXEC_REPL_INPUT';

export interface Device {
  id: number;
  title: string;
  secret: string;
  type: string;
}

export interface WebSocketEndpointInformation {
  endpoint: string;
  clientNamePrefix: string;
  thingName: string;
}

export type DeviceConnection =
  | { status: 'CONNECTING'; client: SlingClient; endpoint: WebSocketEndpointInformation }
  | { status: 'CONNECTED'; client: SlingClient; endpoint: WebSocketEndpointInformation }
  | { status: 'FAILED'; error?: string; client?: SlingClient };

export interface DeviceSession {
  workspace: WorkspaceLocation;
  device: Device;
  connection: DeviceConnection;
}
