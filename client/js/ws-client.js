// WebSocket client partagé
const WS = (() => {
  let socket = null;
  const handlers = {};

  function connect(onOpen) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}`;
    socket = new WebSocket(url);

    socket.onopen = () => { if (onOpen) onOpen(); };

    socket.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      const fn = handlers[msg.type];
      if (fn) fn(msg);
      const anyFn = handlers['*'];
      if (anyFn) anyFn(msg);
    };

    socket.onclose = () => {
      const fn = handlers['disconnect'];
      if (fn) fn();
    };

    socket.onerror = () => {
      const fn = handlers['error'];
      if (fn) fn();
    };
  }

  function send(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  function on(type, fn) { handlers[type] = fn; }
  function off(type) { delete handlers[type]; }

  return { connect, send, on, off };
})();

