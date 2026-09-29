const fs = require('fs');
const WebSocket = require('C:/Users/ercin/Desktop/coding/movie site/node_modules/ws');

(async () => {
  const exprs = JSON.parse(fs.readFileSync(__dirname + '/cdp-expr.json', 'utf8').replace(/^\uFEFF/, ''));
  const list = await (await fetch('http://localhost:9333/json/list')).json();
  const ws = new WebSocket(list[0].webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0;
  const pending = new Map();
  const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result); }
  });
  await new Promise((r) => ws.on('open', r));
  await send('Runtime.enable');
  for (const expr of exprs) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    const label = expr.length > 74 ? expr.slice(0, 74) + '…' : expr;
    console.log(`\n--- ${label} ---`);
    console.log(JSON.stringify(r.exceptionDetails ? { error: r.exceptionDetails.text } : r.result.value, null, 2));
  }
  ws.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
