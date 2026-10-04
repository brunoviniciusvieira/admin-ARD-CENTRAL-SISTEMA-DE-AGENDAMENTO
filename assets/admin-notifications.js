(() => {
  'use strict';
  const key = 'ard-notificacoes-ativas';
  const backgroundKey = 'ard-notificacoes-segundo-plano';
  const button = document.getElementById('ativarNotificacoes');
  const test = document.getElementById('testarNotificacoes');
  const status = document.getElementById('statusNotificacoes');
  const keepBackground = document.getElementById('manterSegundoPlano');
  const batteryButton = document.getElementById('abrirConfiguracaoBateria');
  const backgroundStatus = document.getElementById('statusSegundoPlano');
  const banner = document.getElementById('avisoAgendamento');
  const bannerText = document.getElementById('textoAvisoAgendamento');
  const closeBannerButton = document.getElementById('fecharAvisoAgendamento');
  if (!button || !test || !status || !banner || !bannerText || !closeBannerButton) return;
  let enabled = false;
  let audio;
  let registration;
  let backgroundMode = '';
  let keepAlive = true;
  const seen = new Set();
  let baselineReady = false;
  const known = new Set();
  try { enabled = localStorage.getItem(key) === 'true'; } catch {}
  try { keepAlive = localStorage.getItem(backgroundKey) !== 'false'; } catch {}
  const supported = window.isSecureContext && 'Notification' in window;

  function getBatteryInstruction() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) {
      return 'Android: abra Configurações > Apps > navegador > Bateria e marque "Sem restrição".';
    }
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) {
      return 'iPhone/iPad: em Ajustes > Safari, desative "Economia de Energia" quando precisar de alertas imediatos.';
    }
    return 'No sistema, desative o modo de economia de bateria para o navegador e mantenha o app instalado.';
  }

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
    if (active && supported && Notification.permission === 'granted') {
      if (backgroundMode === 'periodic') {
        status.textContent = 'Avisos ativos. O app tentará checar novos agendamentos em segundo plano quando o navegador permitir.';
      } else if (backgroundMode === 'sync') {
        status.textContent = 'Avisos ativos. O app fará verificações em segundo plano quando houver oportunidade de sincronização.';
      } else if (!keepAlive) {
        status.textContent = 'Avisos ativos sem reforço em segundo plano. Ative essa opção nas configurações para reduzir atrasos.';
      } else {
        status.textContent = 'Avisos ativos. Para reduzir atrasos em segundo plano, mantenha o app instalado e desative a economia de bateria para o navegador.';
      }
    }
    if (keepBackground) keepBackground.checked = keepAlive;
    if (backgroundStatus) {
      backgroundStatus.textContent = keepAlive
        ? `Modo em segundo plano ativado. ${getBatteryInstruction()}`
        : 'Modo em segundo plano desativado. Os avisos tocarão quando o painel estiver aberto.';
    }
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
      const registered = await navigator.serviceWorker.register('./assets/notification-worker.js?v=20261004-2');
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

  async function configureBackgroundChecks() {
    if (!keepAlive) {
      backgroundMode = '';
      return;
    }
    const activeRegistration = await worker();
    let mode = '';
    if (typeof activeRegistration.active?.postMessage === 'function') {
      activeRegistration.active.postMessage({ type: 'CHECK_AGENDAMENTOS' });
    }
    if ('periodicSync' in activeRegistration) {
      try {
        await activeRegistration.periodicSync.register('ard-check-agendamentos', { minInterval: 15 * 60 * 1000 });
        mode = 'periodic';
      } catch {}
    }
    if (!mode && 'sync' in activeRegistration) {
      try {
        await activeRegistration.sync.register('ard-check-agendamentos');
        mode = 'sync';
      } catch {}
    }
    backgroundMode = mode;
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
        data: { url: new URL('./index.html', document.baseURI).href },
        renotify: !preview,
        requireInteraction: !preview,
        silent: false
    };
    // Local feedback must not depend on service worker or OS notification success.
    banner.hidden = false;
    bannerText.textContent = `${title}. ${options.body}`;
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
      if (enabled) await configureBackgroundChecks();
      render();
      if (enabled) await notify({}, true);
    } catch { render('Não foi possível ativar. Verifique a permissão do navegador.'); }
    finally { button.disabled = false; }
  });
  test.addEventListener('click', async () => { await prepareAudio(); await notify({}, true); });
  keepBackground?.addEventListener('change', async () => {
    keepAlive = keepBackground.checked;
    try { localStorage.setItem(backgroundKey, String(keepAlive)); } catch {}
    if (enabled && keepAlive) {
      try { await configureBackgroundChecks(); }
      catch {}
    } else {
      backgroundMode = '';
    }
    render();
  });
  batteryButton?.addEventListener('click', () => {
    const instruction = getBatteryInstruction();
    if (backgroundStatus) backgroundStatus.textContent = instruction;
    window.alert(`Para notificações mais estáveis:\n\n${instruction}`);
  });
  document.addEventListener('pointerdown', () => { if (enabled) void prepareAudio(); }, { once: true });
  document.addEventListener('keydown', () => { if (enabled) void prepareAudio(); }, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('storage', event => {
    if (event.key === key) { enabled = event.newValue === 'true'; render(); }
  });
  closeBannerButton.addEventListener('click', () => {
    banner.hidden = true;
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
  if (enabled) void configureBackgroundChecks().finally(render);
  render();
})();
