(() => {
  const byId = id => document.getElementById(id);
  const dateFor = offset => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return obterChaveData(date);
  };
  function syncFilters() {
    document.querySelectorAll('[data-quick-date]').forEach(button => {
      const value = button.dataset.quickDate === 'all' ? '' : dateFor(button.dataset.quickDate === 'tomorrow' ? 1 : 0);
      button.setAttribute('aria-pressed', String(byId('filtroData').value === value));
    });
    document.querySelectorAll('[data-quick-status]').forEach(button => {
      button.setAttribute('aria-pressed', String(byId('filtroStatus').value === button.dataset.quickStatus));
    });
  }
  document.querySelectorAll('[data-quick-date]').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.quickDate === 'all' ? '' : dateFor(button.dataset.quickDate === 'tomorrow' ? 1 : 0);
      if (value) {
        const [year, month] = value.split('-').map(Number);
        mesCalendarioAdmin = new Date(year, month - 1, 1);
      }
      selecionarDataCalendarioAdmin(value);
    });
  });
  document.querySelectorAll('[data-quick-status]').forEach(button => {
    button.addEventListener('click', () => {
      byId('filtroStatus').value = button.dataset.quickStatus;
      byId('filtroStatus').dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  document.addEventListener('admin:filters-updated', syncFilters);
  syncFilters();

  const refresh = byId('atualizarPainel');
  refresh.addEventListener('click', async () => {
    if (refresh.disabled) return;
    const label = refresh.textContent;
    refresh.disabled = true;
    refresh.setAttribute('aria-busy', 'true');
    refresh.textContent = 'Atualizando agenda…';
    try {
      await carregarAgendamentos();
    } catch {
      atualizarStatusSincronizacao('Não foi possível atualizar. Tente novamente.', false);
    } finally {
      refresh.disabled = false;
      refresh.removeAttribute('aria-busy');
      refresh.textContent = label;
    }
  });

  const views = { abaOperacao: 'operacao', abaRendimento: 'rendimento', abaConfiguracoes: 'configuracoes' };
  Object.entries(views).forEach(([id, view]) => {
    const button = byId(id);
    button.setAttribute('aria-controls', { operacao: 'visaoOperacao', rendimento: 'visaoRendimento', configuracoes: 'visaoConfiguracoes' }[view]);
    button.setAttribute('aria-pressed', button.getAttribute('aria-selected'));
    button.addEventListener('click', () => {
      try { sessionStorage.setItem('ard-admin-view', view); } catch { /* Storage may be unavailable. */ }
    });
  });
  try {
    const saved = sessionStorage.getItem('ard-admin-view');
    if (Object.values(views).includes(saved)) ativarAba(saved);
  } catch { /* Keep the default view. */ }
})();
