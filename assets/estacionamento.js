(() => {
  'use strict';
  const C = ParkingCore, KEY = 'ard-parking-clients-v1', NOTIFIED = 'ard-parking-notified-v1';
  const $ = id => document.getElementById(id), form = $('client-form');
  let clients = [], editing = null, renewing = null, editSnapshot = null, renewSnapshot = null;
  let ready = false, busy = false, loading = false, generation = 0, unsubscribe = null, db;
  const fmt = date => date.split('-').reverse().join('/');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  function feedback(message, error = false) { $('feedback').textContent = message; $('feedback').classList.toggle('error', error); if ($('renew-dialog').open) $('renew-feedback').textContent = error ? message : ''; }
  function connection(message, error = false) { $('db-status').textContent = message; $('db-status').classList.toggle('error',error); }
  function controls() {
    const disabled = !ready || busy || loading;
    document.querySelectorAll('#client-form input, #client-form button, #client-list button, #renew-form input, #renew-form button, #export, #import, #migrate-local').forEach(el => { el.disabled = disabled; });
    $('refresh-db').disabled = busy || loading || !db;
    $('client-list').setAttribute('aria-busy',String(busy || loading));
  }
  function parse(raw) {
    const list = JSON.parse(raw); if (!Array.isArray(list)) throw new Error('Backup inválido.');
    const plates = new Set();
    return list.map(item => { const data = C.validate(item); if (plates.has(data.plate)) throw new Error('O backup possui placas duplicadas.'); plates.add(data.plate); return data; });
  }
  function localRows() { return parse(localStorage.getItem(KEY) || '[]'); }
  function migrationStatus() {
    try { $('migration-panel').hidden = !ready || !localRows().some(c => !clients.some(remote => remote.plate === c.plate)); }
    catch { $('migration-panel').hidden = true; feedback('Há dados locais indisponíveis ou inválidos. Eles foram preservados e não foram enviados ao banco.',true); }
  }
  async function load() {
    if (!db || busy || loading) return;
    loading = true; controls(); const token = generation;
    connection('Atualizando dados do banco...');
    try {
      const rows = await db.list();
      if (token !== generation) return;
      clients = rows; ready = true;
      connection('Conectado ao banco · atualizado às ' + new Date().toLocaleTimeString('pt-BR'));
      if (!unsubscribe) unsubscribe = db.subscribe(() => { load(); });
      migrationStatus();
    } catch(error) {
      if (token !== generation) return;
      // Não apresentar uma lista antiga como se estivesse sincronizada.
      ready = false; clients = [];
      $('migration-panel').hidden = true;
      connection(error.message,true);
    } finally {
      loading = false; render(); controls();
    }
  }
  async function mutate(operation, success) {
    if (!ready || busy || loading) return false;
    busy = true; controls(); const token = generation;
    connection('Salvando no banco...');
    try {
      const result = await operation();
      if (token !== generation) return false;
      success(result);
      return true;
    } catch(error) {
      if (token === generation) feedback(error.message + ' Nenhuma alteração local foi marcada como salva.',true);
      return false;
    } finally {
      busy = false; controls();
      if (token === generation) await load();
    }
  }
  function preview() { try { const days = Number(form.elements.days.value); $('due-preview').textContent = days >= 1 && days <= 3650 && Number.isInteger(days) ? fmt(C.due(form.elements.start.value,days)) : '—'; } catch { $('due-preview').textContent = '—'; } }
  function reset() { form.reset(); editing = null; form.elements.start.value = C.today(); $('form-title').textContent = 'Novo mensalista'; $('save-client').textContent = 'Cadastrar mensalista'; $('cancel-edit').hidden = true; preview(); }
  function render() {
    const rows = clients.map(client => ({...client,...C.status(client)}));
    const expired = rows.filter(c => c.kind === 'expired');
    $('total').textContent = rows.length; $('active').textContent = rows.filter(c => ['active','soon'].includes(c.kind)).length; $('soon').textContent = rows.filter(c => c.kind === 'soon').length; $('expired').textContent = expired.length;
    $('expiry-alert').textContent = !ready ? 'Aguardando conexão com o banco para verificar os vencimentos.' : expired.length ? `${expired.length} contrato(s) vencido(s). Avise o cliente pelo WhatsApp e registre a renovação.` : 'Nenhum contrato vencido. Seus avisos aparecerão aqui.';
    document.querySelector('.alerts').classList.toggle('has-expired',expired.length > 0);
    const query = normalize($('search').value.trim()), filter = $('filter').value;
    const visible = rows.filter(c => (filter === 'all' || (filter === 'active' ? ['active','soon'].includes(c.kind) : c.kind === filter)) && normalize(`${c.name} ${c.plate} ${c.car}`).includes(query)).sort((a,b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
    $('result-count').textContent = `${visible.length} cliente(s)`;
    $('client-list').innerHTML = visible.length ? visible.map(c => {
      const label = c.kind === 'expired' ? (c.remaining === 0 ? 'Vence hoje · renovar' : `Vencido há ${-c.remaining} dia(s)`) : c.kind === 'scheduled' ? 'Ainda não iniciado' : `Faltam ${c.remaining} dia(s)`;
      const message = `Olá, ${c.name}! Aqui é da ARD CENTRAL. O contrato do estacionamento do veículo ${c.car}, placa ${c.plate}, venceu em ${fmt(c.due)}. Vamos renovar por mais ${c.days} dias? Entre em contato para confirmar. Obrigado!`;
      return `<article class="client ${c.kind}"><div class="client-top"><div><h3>${escape(c.name)}</h3><p>${escape(c.car)} · <strong>${escape(c.plate)}</strong></p><p>WhatsApp: +${escape(c.phone)}</p></div><span class="badge">${label}</span></div><div class="contract-info"><span>Início <strong>${fmt(c.start)}</strong></span><span>Período <strong>${c.days} dias</strong></span><span>Vencimento <strong>${fmt(c.due)}</strong></span></div><div class="actions">${c.kind === 'expired' ? `<a class="button whatsapp" href="https://wa.me/${c.phone}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">Avisar pelo WhatsApp ↗</a>` : ''}<button type="button" class="primary" data-action="renew" data-id="${escape(c.id)}">Renovar</button><button type="button" class="secondary" data-action="edit" data-id="${escape(c.id)}">Editar</button><button type="button" class="delete" data-action="delete" data-id="${escape(c.id)}">Excluir</button></div></article>`;
    }).join('') : `<div class="empty"><strong>${clients.length ? 'Nenhum mensalista encontrado' : 'Seu primeiro mensalista começa aqui'}</strong><p>${clients.length ? 'Ajuste a busca ou o filtro de situação.' : 'Preencha o cadastro para acompanhar contratos e renovações.'}</p></div>`;
    if (!ready) $('client-list').innerHTML = '<div class="empty"><strong>Cadastros aguardando conexão</strong><p>Atualize os dados para consultar os mensalistas.</p></div>';
    if (ready) notify(expired);
    controls();
  }
  function notify(expired) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const seen = JSON.parse(localStorage.getItem(NOTIFIED) || '[]'); if (!Array.isArray(seen)) return;
      const unseen = expired.filter(c => !seen.includes(`${c.id}:${c.due}`)); if (!unseen.length) return;
      const notification = new Notification('ARD CENTRAL · Estacionamento', { body:`${unseen.length} contrato(s) vencido(s). Abra o estacionamento para renovar.`, tag:'ard-parking-expiry',icon:'assets/favicon.jpeg' });
      notification.onclick = () => { window.focus(); notification.close(); };
      localStorage.setItem(NOTIFIED, JSON.stringify([...seen,...unseen.map(c => `${c.id}:${c.due}`)].slice(-5000)));
    } catch { $('notification-status').textContent = 'Os avisos continuam no painel. Este navegador não disponibilizou notificações externas.'; }
  }

  form.addEventListener('input',preview);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const data = C.validate(Object.fromEntries(new FormData(form)));
      if (clients.some(c => c.plate === data.plate && c.id !== editing)) throw new Error('Esta placa já possui cadastro. Edite ou renove o contrato existente.');
      const original = editing ? editSnapshot : null;
      await mutate(() => original ? db.update(original,data) : db.insert(data), () => {
        feedback(original ? 'Cadastro atualizado no banco.' : 'Mensalista cadastrado no banco.'); reset(); editSnapshot = null;
      });
    } catch(error) { feedback(error.message,true); }
  });
  $('cancel-edit').onclick = () => { reset(); editSnapshot = null; };
  $('search').addEventListener('input',render); $('filter').addEventListener('change',render);
  $('client-list').addEventListener('click',async event => {
    const button = event.target.closest('button[data-action]'); if (!button || !ready || busy || loading) return;
    const client = clients.find(c => c.id === button.dataset.id); if (!client) return;
    if (button.dataset.action === 'edit') {
      editing = client.id; editSnapshot = {...client};
      for (const key of ['name','phone','plate','car','start','days']) form.elements[key].value = client[key];
      $('form-title').textContent = 'Editar mensalista'; $('save-client').textContent = 'Salvar alterações'; $('cancel-edit').hidden = false; preview(); form.elements.name.focus();
    }
    if (button.dataset.action === 'delete' && confirm('Excluir o cadastro de ' + client.name + ', placa ' + client.plate + ', do banco de dados?')) {
      await mutate(() => db.remove(client), () => { if (editing === client.id) reset(); feedback('Cadastro excluído do banco.'); });
    }
    if (button.dataset.action === 'renew') {
      renewing = client.id; renewSnapshot = {...client}; $('renew-feedback').textContent = ''; $('renew-name').textContent = client.name + ' · ' + client.plate;
      $('renew-form').elements.start.value = C.due(client.start,client.days) > C.today() ? C.due(client.start,client.days) : C.today();
      $('renew-form').elements.days.value = client.days; $('renew-dialog').showModal();
    }
  });
  $('cancel-renew').onclick = () => $('renew-dialog').close();
  $('renew-form').onsubmit = async event => {
    event.preventDefault();
    try {
      if (!renewSnapshot) throw new Error('Abra novamente o contrato para renovar.');
      const data = C.validate({...renewSnapshot,...Object.fromEntries(new FormData(event.target))});
      await mutate(() => db.update(renewSnapshot,data), () => {
        $('renew-dialog').close(); if (editing === renewing) reset();
        feedback('Contrato renovado no banco. Novo vencimento: ' + fmt(C.due(data.start,data.days)) + '.');
      });
    } catch(error) { feedback(error.message,true); }
  };
  $('enable-notifications').onclick = async () => {
    try {
      if (!window.isSecureContext || !('Notification' in window)) throw new Error('Notificações externas exigem HTTPS e navegador compatível. Os avisos no painel continuam ativos.');
      const permission = await Notification.requestPermission();
      $('notification-status').textContent = permission === 'granted' ? 'Notificações permitidas. Mantenha o sistema aberto para receber os avisos.' : 'Permissão não concedida. Os avisos continuam no painel.'; render();
    } catch(error) { $('notification-status').textContent = error.message; }
  };
  $('export').onclick = () => {
    if (!ready) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(clients,null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'ard-estacionamento-' + C.today() + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  async function importRows(rows) {
    if (!rows.length) { feedback('Nenhum cadastro para importar.'); return; }
    if (!confirm('Adicionar ' + rows.length + ' cadastro(s) ao banco? Placas já cadastradas serão preservadas, sem sobrescrever dados.')) return;
    await mutate(() => db.importRows(rows), count => {
      feedback(count + ' cadastro(s) adicionado(s) ao banco. ' + (rows.length - count) + ' placa(s) já existente(s) preservada(s).');
    });
  }
  $('import').onclick = () => $('import-file').click();
  $('import-file').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try { if (file.size > 5000000) throw new Error('O backup deve ter no máximo 5 MB.'); await importRows(parse(await file.text())); }
    catch(error) { feedback('Não foi possível importar: ' + error.message,true); }
    finally { event.target.value = ''; }
  };
  $('migrate-local').onclick = async () => { try { await importRows(localRows()); } catch(error) { feedback(error.message,true); } };
  $('refresh-db').onclick = load;
  window.addEventListener('online',load); window.addEventListener('focus',load);
  document.addEventListener('visibilitychange',() => { if (!document.hidden) load(); });
  setInterval(() => { if (!document.hidden) load(); },30000);
  reset(); render();
  try {
    if (!window.supabase || !window.ARD_SUPABASE) throw new Error('Não foi possível carregar a conexão com o banco. Verifique a internet e recarregue a página.');
    db = ParkingDatabase.create(window.supabase.createClient(window.ARD_SUPABASE.url,window.ARD_SUPABASE.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
    load();
    controls();
  } catch(error) { connection(error.message,true); controls(); }
})();
