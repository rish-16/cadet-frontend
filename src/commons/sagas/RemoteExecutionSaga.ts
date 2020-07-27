import { assemble, compile, Context } from 'js-slang';
import { ExceptionError } from 'js-slang/dist/errors/errors';
import { SagaIterator } from 'redux-saga';
import { call, put, select, takeEvery, takeLatest } from 'redux-saga/effects';
import { SlingClient } from 'sling-client';

import {
  Device,
  DeviceSession,
  REMOTE_EXEC_CONNECT,
  REMOTE_EXEC_DISCONNECT,
  REMOTE_EXEC_FETCH_DEVICES,
  REMOTE_EXEC_RUN,
  WebSocketEndpointInformation
} from '../../features/remoteExecution/RemoteExecutionTypes';
import { store } from '../../pages/createStore';
import { OverallState } from '../application/ApplicationTypes';
import { actions } from '../utils/ActionsHelper';
import { fetchDevices, getDeviceWSEndpoint } from './RequestsSaga';

const dummyLocation = {
  start: { line: 0, column: 0 },
  end: { line: 0, column: 0 }
};

export function* remoteExecutionSaga(): SagaIterator {
  yield takeLatest(REMOTE_EXEC_FETCH_DEVICES, function* () {
    const [tokens, session]: [any, DeviceSession | undefined] = yield select(
      (state: OverallState) => [
        {
          accessToken: state.session.accessToken,
          refreshToken: state.session.refreshToken
        },
        state.session.remoteExecutionSession
      ]
    );
    const devices: Device[] = yield call(fetchDevices, tokens);

    yield put(actions.remoteExecUpdateDevices(devices));

    if (!session) {
      return;
    }
    const updatedDevice = devices.find(({ id }) => id === session.device.id);
    if (updatedDevice) {
      yield put(
        actions.remoteExecUpdateSession({
          ...session,
          device: updatedDevice
        })
      );
    }
  });

  yield takeLatest(REMOTE_EXEC_CONNECT, function* (
    action: ReturnType<typeof actions.remoteExecConnect>
  ) {
    const [tokens, session]: [any, DeviceSession | undefined] = yield select(
      (state: OverallState) => [
        {
          accessToken: state.session.accessToken,
          refreshToken: state.session.refreshToken
        },
        state.session.remoteExecutionSession
      ]
    );
    const endpoint: WebSocketEndpointInformation | null = yield call(
      getDeviceWSEndpoint,
      action.payload.device,
      tokens
    );
    if (!endpoint) {
      // TODO handle error
      return;
    }

    const oldClient = session?.connection.client;
    if (oldClient) {
      oldClient.disconnect();
    }
    const client: SlingClient = new SlingClient({
      clientId: `${endpoint.clientNamePrefix}${generateClientNonce()}`,
      deviceId: endpoint.thingName,
      websocketEndpoint: endpoint.endpoint
    });
    client.on('statusChange', isRunning => {
      store.dispatch(
        actions.updateWorkspace(action.payload.workspace, {
          isRunning
        })
      );
    });
    client.on('display', (message, type) => {
      switch (type) {
        case 'output':
          store.dispatch(actions.handleConsoleLog(message, action.payload.workspace));
          break;
        case 'error': {
          const error = new ExceptionError(new Error(message), dummyLocation);
          store.dispatch(actions.evalInterpreterError([error], action.payload.workspace));
          break;
        }
        case 'result':
          store.dispatch(actions.evalInterpreterSuccess(message, action.payload.workspace));
          break;
      }
    });

    yield put(
      actions.remoteExecUpdateSession({
        ...action.payload,
        connection: { status: 'CONNECTING', client, endpoint }
      })
    );
    try {
      // TODO cancel connect and handle error
      yield new Promise((resolve, reject) => {
        client.once('connect', resolve);
        client.once('error', reject);
        client.connect();
      });
      yield put(
        actions.remoteExecUpdateSession({
          ...action.payload,
          connection: { status: 'CONNECTED', client, endpoint }
        })
      );
    } catch (err) {
      yield put(
        actions.remoteExecUpdateSession({
          ...action.payload,
          connection: { status: 'FAILED', client, error: err.toString() }
        })
      );
    }
  });

  yield takeLatest(REMOTE_EXEC_DISCONNECT, function* (
    action: ReturnType<typeof actions.remoteExecDisconnect>
  ) {
    // TODO disconnect
    yield put(actions.remoteExecUpdateSession(undefined));
  });

  yield takeEvery(REMOTE_EXEC_RUN, function* ({
    payload: program
  }: ReturnType<typeof actions.remoteExecRun>) {
    const session: DeviceSession | undefined = yield select(
      (state: OverallState) => state.session.remoteExecutionSession
    );
    if (!session || session.connection.status !== 'CONNECTED') {
      return;
    }

    const client = session.connection.client;
    const context: Context = yield select(
      (state: OverallState) => state.workspaces[session.workspace].context
    );
    const compiled: ReturnType<typeof compile> = yield call(compile, program, context);
    if (!compiled) {
      yield put(actions.evalInterpreterError(context.errors, session.workspace));
      return;
    }
    const assembled = assemble(compiled);

    client.sendRun(Buffer.from(assembled));
  });
}

const ALPHANUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const generateClientNonce = () =>
  new Array(16)
    .fill(undefined)
    .map(_ => ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)])
    .join('');

export default remoteExecutionSaga;
