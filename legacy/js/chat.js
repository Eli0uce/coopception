// Chat widget partagé — Firebase
const Chat = (() => {
  let myRole = null;
  let visible = true;

  function init(role) {
    myRole = role;
    const toggle = document.getElementById('chat-toggle');
    const body   = document.getElementById('chat-body');
    const input  = document.getElementById('chat-input');
    const send   = document.getElementById('chat-send');

    toggle.addEventListener('click', () => {
      visible = !visible;
      body.style.display = visible ? 'flex' : 'none';
      toggle.textContent = visible ? '💬 COMM — MASQUER' : '💬 COMM — AFFICHER';
    });

    send.addEventListener('click', sendMsg);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

    GameDB.onChat(msg => {
      addMessage(msg.from === myRole ? 'me' : 'other', msg.from.toUpperCase(), msg.text);
    });

    function sendMsg() {
      const text = input.value.trim();
      if (!text) return;
      GameDB.sendChat(text);
      input.value = '';
    }
  }

  function addMessage(type, from, text) {
    const div = document.createElement('div');
    div.className = `msg ${type}`;
    div.innerHTML = `<span class="from">[${from}]</span>${esc(text)}`;
    const msgs = document.getElementById('chat-messages');
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addSystem(text) {
    const div = document.createElement('div');
    div.className = 'msg system';
    div.textContent = '— ' + text + ' —';
    const msgs = document.getElementById('chat-messages');
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, addSystem };
})();

