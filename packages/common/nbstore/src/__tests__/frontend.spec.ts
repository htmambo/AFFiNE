import 'fake-indexeddb/auto';

import { expect, test, vitest } from 'vitest';
import { Awareness } from 'y-protocols/awareness.js';
import { Doc as YDoc } from 'yjs';

import { AwarenessFrontend } from '../frontend/awareness';
import { DocFrontend } from '../frontend/doc';
import { BroadcastChannelAwarenessStorage } from '../impls/broadcast-channel/awareness';
import { IndexedDBDocStorage } from '../impls/idb';
import { AwarenessSync } from '../sync/awareness';
import { expectYjsEqual } from './utils';

test('doc', async () => {
  const doc1 = new YDoc({
    guid: 'test-doc',
  });
  doc1.getMap('test').set('hello', 'world');

  const docStorage = new IndexedDBDocStorage({
    id: 'ws1',
    peer: 'a',
    type: 'workspace',
  });

  await docStorage.connect();

  const frontend1 = new DocFrontend(docStorage, null);
  frontend1.start();
  frontend1.addDoc(doc1);
  await vitest.waitFor(async () => {
    const doc = await docStorage.getDoc('test-doc');
    expectYjsEqual(doc!.bin, {
      test: {
        hello: 'world',
      },
    });
  });

  const doc2 = new YDoc({
    guid: 'test-doc',
  });
  const frontend2 = new DocFrontend(docStorage, null);
  frontend2.start();
  frontend2.addDoc(doc2);

  await vitest.waitFor(async () => {
    expectYjsEqual(doc2, {
      test: {
        hello: 'world',
      },
    });
  });
});

test('awareness', async () => {
  const storage1 = new BroadcastChannelAwarenessStorage({
    id: 'ws1',
    peer: 'a',
    type: 'workspace',
  });

  const storage2 = new BroadcastChannelAwarenessStorage({
    id: 'ws1',
    peer: 'b',
    type: 'workspace',
  });

  await storage1.connect();
  await storage2.connect();

  // peer a
  const docA = new YDoc({ guid: 'test-doc' });
  docA.clientID = 1;
  const awarenessA = new Awareness(docA);

  // peer b
  const docB = new YDoc({ guid: 'test-doc' });
  docB.clientID = 2;
  const awarenessB = new Awareness(docB);

  // peer c
  const docC = new YDoc({ guid: 'test-doc' });
  docC.clientID = 3;
  const awarenessC = new Awareness(docC);

  {
    const sync = new AwarenessSync(storage1, [storage2]);
    const frontend = new AwarenessFrontend(sync);
    frontend.connect(awarenessA);
    frontend.connect(awarenessB);
  }
  {
    const sync = new AwarenessSync(storage2, [storage1]);
    const frontend = new AwarenessFrontend(sync);
    frontend.connect(awarenessC);
  }

  awarenessA.setLocalState({
    hello: 'world',
  });

  await vitest.waitFor(() => {
    expect(awarenessB.getStates().get(1)).toEqual({
      hello: 'world',
    });
    expect(awarenessC.getStates().get(1)).toEqual({
      hello: 'world',
    });
  });

  awarenessB.setLocalState({
    foo: 'bar',
  });

  await vitest.waitFor(() => {
    expect(awarenessA.getStates().get(2)).toEqual({
      foo: 'bar',
    });
    expect(awarenessC.getStates().get(2)).toEqual({
      foo: 'bar',
    });
  });

  awarenessC.setLocalState({
    baz: 'qux',
  });

  await vitest.waitFor(() => {
    expect(awarenessA.getStates().get(3)).toEqual({
      baz: 'qux',
    });
    expect(awarenessB.getStates().get(3)).toEqual({
      baz: 'qux',
    });
  });
});
