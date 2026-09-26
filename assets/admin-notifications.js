(() => {
  'use strict';
  const key = 'ard-notificacoes-ativas';
  const button = document.getElementById('ativarNotificacoes');
  const test = document.getElementById('testarNotificacoes');
  const status = document.getElementById('statusNotificacoes');
  let enabled = false;
  let audio;
  let registration;
  const seen = new Set();
  let baselineReady = false;
  const known = new Set();
  try { enabled = localStorage.getItem(key) === 'true'; } catch {}
  const supported = window.isSecureContext && 'Notification' in window;

  function render(message) {
    const active = enabled;
    button.textContent = active ? 'Desativar notificações' : 'Ativar notificações';
    button.setAttribute('aria-pressed', String(active));
    button.disabled = false;
    test.hidden = !active;
    status.textContent = message || (!supported
      ? 'Avisos do sistema indisponíveis. Ative os avisos no painel; para avisos externos, use HTTPS e um navegador compatível.'
      : Notification.permission === 'denied'
        ? 'Avisos do sistema bloqueados. Os avisos ativados aparecem no painel. Libere a permissão do site para avisos externos.'
        : active
          ? 'Avisos de novos agendamentos ativos. Clique em Testar aviso para liberar o som nesta visita.'
          : 'Ative para receber avisos de novos agendamentos neste dispositivo.');
  }

  async function prepareAudio() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === 'suspended') await audio.resume();
    } catch { /* The system may block audio. */ }
  }

  function sound() {
    if (!audio || audio.state !== 'running') return;
    const start = audio.currentTime;
    [660, 880].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = start + index * 0.22;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.2);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.22);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }

  async function worker() {
    if (!('serviceWorker' in navigator)) throw new Error('Service worker indisponível');
    if (!registration) {
      const registered = await navigator.serviceWorker.register('./assets/notification-worker.js');
      if (registered.active) registration = registered;
      else registration = await new Promise((resolve, reject) => {
        const pending = registered.installing || registered.waiting;
        const timeout = setTimeout(() => { cleanup(); reject(new Error('Ativação do serviço demorou demais')); }, 8000);
        function cleanup() { clearTimeout(timeout); pending?.removeEventListener('statechange', check); }
        function check() {
          if (registered.active || pending?.state === 'activated') { cleanup(); resolve(registered); }
          else if (!pending || pending.state === 'redundant') { cleanup(); reject(new Error('Serviço de notificações não ativado')); }
        }
        pending?.addEventListener('statechange', check);
        check();
      });
    }
    return registration;
  }

  async function notify(item, preview = false) {
    if (!enabled) return;
    if (!preview && (item.id == null || seen.has(String(item.id)))) return;
    if (!preview) seen.add(String(item.id));
    const title = preview ? 'ARD Central — teste de aviso' : 'ARD Central — novo agendamento';
    const date = String(item.data_agendamento || '').split('-').reverse().join('/');
    const options = {
        body: preview ? 'Notificações ativadas. Som e vibração dependem do aparelho.' : `Novo atendimento${date ? ` em ${date}` : ''}${item.horario_agendamento ? ` às ${String(item.horario_agendamento).slice(0, 5)}` : ''}. Abra o painel para conferir.`,
        icon: new URL('./assets/logo-ard-render.png', document.baseURI).href,
        tag: preview ? 'ard-teste' : `ard-agendamento-${item.id}`,
        vibrate: [200, 100, 200],
        data: { url: new URL('./index.html', document.baseURI).href }
    };
    // Local feedback must not depend on service worker or OS notification success.
    const banner = document.getElementById('avisoAgendamento');
    banner.hidden = false;
    document.getElementById('textoAvisoAgendamento').textContent = `${title}. ${options.body}`;
    sound();
    if (!document.hidden && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate([200, 100, 200]); } catch {}
    }
    if (!supported || Notification.permission !== 'granted') {
      render('Aviso exibido no painel. Para receber fora dele, permita notificações neste site em HTTPS.');
      return;
    }
    try {
      try { await (await worker()).showNotification(title, options); }
      catch (workerError) {
        // Desktop browsers can still notify if the worker file was not deployed.
        try {
          const notification = new Notification(title, options);
          notification.onclick = () => { window.focus(); notification.close(); };
        } catch { throw workerError; }
      }
      status.textContent = 'Aviso enviado ao sistema. Se não apareceu, confira as notificações do navegador e o modo Não Perturbe.';
    } catch (error) {
      render(`Aviso exibido no painel, mas o aviso do sistema falhou: ${error.message || error.name}. Verifique se assets/notification-worker.js foi publicado junto com o site.`);
    }
  }

  button.addEventListener('click', async () => {
    if (enabled) {
      enabled = false;
      try { localStorage.setItem(key, 'false'); } catch {}
      render();
      return;
    }
    button.disabled = true;
    try {
      // Request directly from the click, before awaiting any other operation.
      const permission = supported ? Notification.requestPermission() : Promise.resolve('unavailable');
      void prepareAudio();
      await permission;
      enabled = true;
      try { localStorage.setItem(key, String(enabled)); } catch {}
      render();
      if (enabled) await notify({}, true);
    } catch { render('Não foi possível ativar. Verifique a permissão do navegador.'); }
    finally { button.disabled = false; }
  });
  test.addEventListener('click', async () => { await prepareAudio(); await notify({}, true); });
  document.addEventListener('pointerdown', () => { if (enabled) void prepareAudio(); }, { once: true });
  document.addEventListener('keydown', () => { if (enabled) void prepareAudio(); }, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('storage', event => {
    if (event.key === key) { enabled = event.newValue === 'true'; render(); }
  });
  document.getElementById('fecharAvisoAgendamento').addEventListener('click', () => {
    document.getElementById('avisoAgendamento').hidden = true;
  });
  window.avisarNovoAgendamento = item => {
    if (item.id != null) known.add(String(item.id));
    void notify(item);
  };
  window.conferirNovosAgendamentos = items => {
    for (const item of items) {
      if (item.id == null) continue;
      const id = String(item.id);
      if (baselineReady && !known.has(id)) void notify(item);
      known.add(id);
    }
    baselineReady = true;
  };
  render();
})();
