'use strict';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const SUPABASE_URL = 'https://kjuixvzsekpmzmrbfenf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yzmgQdxxK28G_F1rjCN_9w_LpFTIU1Y';
const STATE_CACHE = 'ard-notification-worker-state-v1';
const LAST_ID_KEY = '/__ard__/last-notified-id';

async function obterUltimoIdNotificado() {
  const cache = await caches.open(STATE_CACHE);
  const resposta = await cache.match(LAST_ID_KEY);
  if (!resposta) return null;
  const texto = await resposta.text();
  return texto || null;
}

async function salvarUltimoIdNotificado(id) {
  if (id == null) return;
  const cache = await caches.open(STATE_CACHE);
  await cache.put(LAST_ID_KEY, new Response(String(id), { headers: { 'content-type': 'text/plain; charset=utf-8' } }));
}

function montarMensagem(item) {
  const data = String(item?.data_agendamento || '').split('-').reverse().join('/');
  return `Novo atendimento${data ? ` em ${data}` : ''}${item?.horario_agendamento ? ` às ${String(item.horario_agendamento).slice(0, 5)}` : ''}. Abra o painel para conferir.`;
}

async function notificarNovoAgendamento(item) {
  if (!item || item.id == null) return;
  await self.registration.showNotification('ARD Central — novo agendamento', {
    body: montarMensagem(item),
    icon: new URL('./logo-ard-render.png', self.registration.scope).href,
    tag: `ard-agendamento-${item.id}`,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: new URL('../index.html', self.registration.scope).href }
  });
}

async function buscarUltimoAgendamento() {
  const url = `${SUPABASE_URL}/rest/v1/agendamentos?select=id,data_agendamento,horario_agendamento&order=id.desc&limit=1`;
  const resposta = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY
    }
  });
  if (!resposta.ok) throw new Error(`Falha ao consultar agendamentos (${resposta.status})`);
  const dados = await resposta.json();
  return Array.isArray(dados) ? (dados[0] || null) : null;
}

async function haPainelAberto() {
  const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return janelas.length > 0;
}

async function verificarNovosAgendamentos() {
  const ultimo = await buscarUltimoAgendamento();
  if (!ultimo || ultimo.id == null) return false;
  const ultimoId = String(ultimo.id);
  const idNotificado = await obterUltimoIdNotificado();
  if (!idNotificado) {
    await salvarUltimoIdNotificado(ultimoId);
    return false;
  }
  if (idNotificado === ultimoId) return false;
  if (await haPainelAberto()) {
    await salvarUltimoIdNotificado(ultimoId);
    return false;
  }
  await notificarNovoAgendamento(ultimo);
  await salvarUltimoIdNotificado(ultimoId);
  return true;
}

self.addEventListener('periodicsync', event => {
  if (event.tag !== 'ard-check-agendamentos') return;
  event.waitUntil(verificarNovosAgendamentos().catch(() => {}));
});

self.addEventListener('sync', event => {
  if (event.tag !== 'ard-check-agendamentos') return;
  event.waitUntil(verificarNovosAgendamentos().catch(() => {}));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'CHECK_AGENDAMENTOS') return;
  event.waitUntil(verificarNovosAgendamentos().catch(() => {}));
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    if (!event.data) return verificarNovosAgendamentos().catch(() => {});
    let payload;
    try { payload = event.data.json(); } catch { payload = null; }
    if (payload?.id != null) {
      await notificarNovoAgendamento(payload);
      await salvarUltimoIdNotificado(payload.id);
      return;
    }
    if (payload?.title || payload?.body) {
      await self.registration.showNotification(payload.title || 'ARD Central', {
        body: payload.body || 'Novo aviso disponível.',
        icon: new URL('./logo-ard-render.png', self.registration.scope).href,
        data: { url: new URL('../index.html', self.registration.scope).href }
      });
      return;
    }
    await verificarNovosAgendamentos().catch(() => {});
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || new URL('../index.html', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url.split('#')[0].split('?')[0] === target);
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});
