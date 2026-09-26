const SUPABASE_URL = 'https://kjuixvzsekpmzmrbfenf.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_yzmgQdxxK28G_F1rjCN_9w_LpFTIU1Y';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const STORAGE_KEY = 'lavajato_servicos_config';
    const AGENDAMENTOS_CACHE_KEY = 'lavajato_agendamentos_cache_v1';
    const SERVICOS_PADRAO = {
      'Lavagem Simples': 40,
      'Completa + Aritana': 60,
      'Polimento + Cera': 90
    };

    const VALORES_SERVICOS_ADMIN = {
      'Lavagem de moto simples': 60,
      'Lavagem de moto com cera': 80,
      'Ducha externa': 70,
      'Limpeza interna': 70,
      'Lavagem Simples': 120,
      'Completa + Aritana': 280,
      'Lavagem Simples com Cera': 150,
      'Lavagem Completa': 280,
      'Lavagem de motor': 80,
      'Lavagem de chassi': 100,
      'Polimento': 450,
      'Polimento + Cera': 450,
      'Cristalização': 450,
      'Higienização': 70,
      'Higienização do ar condicionado': 120,
      'Troca do filtro de ar': 100,
      'Troca do filtro do motor': 150,
      'Hidratação em bancos de couro': 40,
      'Descontaminação de vidros': 180,
      'Descontaminação da pintura': 350,
      'Estacionamento avulso': 6,
      'Estacionamento mensal moto': 120,
      'Estacionamento mensal carro': 160
    };

    let agendamentosCarregados = [];
    let mesCalendarioAdmin = new Date();
    let canalAgendamentos;

    const servicosBanco = ConfiguracaoServicos.criar(supabaseClient, {
      aoAtualizar() {
        document.getElementById('statusTemposServicos').textContent = '';
        if (!document.querySelector('#configuracoesServicos input[data-editado]')) renderizarConfiguracaoServicos();
        renderizarAgendamentos();
      },
      aoErro() {
        document.getElementById('statusTemposServicos').textContent = 'Não foi possível atualizar as durações. Verifique sua conexão e tente novamente.';
      }
    });

    function carregarConfiguracaoServicos() {
      return servicosBanco.obter();
    }

    function salvarCacheAgendamentos() {
      try {
        sessionStorage.setItem(AGENDAMENTOS_CACHE_KEY, JSON.stringify(agendamentosCarregados));
      } catch (error) {
      }
    }

    function carregarCacheAgendamentos() {
      try {
        const salvo = sessionStorage.getItem(AGENDAMENTOS_CACHE_KEY);
        if (!salvo) return null;

        const dados = JSON.parse(salvo);
        return Array.isArray(dados) ? dados : null;
      } catch (error) {
        return null;
      }
    }

    function renderizarConfiguracaoServicos() {
      const container = document.getElementById('configuracoesServicos');
      const servicos = carregarConfiguracaoServicos();
      const ordemServicos = [
        'Lavagem Simples',
        'Lavagem Simples com Cera',
        'Lavagem Completa',
        'Lavagem de moto simples',
        'Lavagem de moto com cera',
        'Lavagem Simples - Caminhonete Cabine Simples',
        'Lavagem Simples com Cera - Caminhonete Cabine Simples',
        'Lavagem Simples - Caminhonete Cabine Dupla',
        'Lavagem Simples com Cera - Caminhonete Cabine Dupla',
        'Lavagem Simples - Van',
        'Lavagem Simples com Cera - Van',
        'Ducha externa',
        'Limpeza interna',
        'Completa + Aritana',
        'Lavagem de motor',
        'Lavagem de chassi',
        'Troca do filtro de ar',
        'Troca do filtro do motor',
        'Higienização',
        'Higienização do ar condicionado',
        'Hidratação em bancos de couro',
        'Descontaminação de vidros',
        'Descontaminação da pintura',
        'Polimento',
        'Polimento + Cera',
        'Cristalização'
      ];
      const prioridade = nome => {
        const indice = ordemServicos.indexOf(nome);
        return indice === -1 ? ordemServicos.length : indice;
      };

      container.innerHTML = Object.entries(servicos)
        .filter(([nome]) => !nome.startsWith('Estacionamento'))
        .sort(([nomeA], [nomeB]) => prioridade(nomeA) - prioridade(nomeB) || nomeA.localeCompare(nomeB, 'pt-BR'))
        .map(([nome, tempo]) => `
        <div class="rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <label class="mb-2 block text-base font-semibold uppercase tracking-wide text-slate-400">${nome}</label>
          <div class="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2">
            <input type="number" min="0.25" max="24" step="any" value="${ConfiguracaoServicos.minutosParaHoras(tempo)}" data-servico="${nome}" class="w-full bg-transparent text-lg font-bold text-white outline-none" />
            <span class="text-base text-slate-400">horas</span>
          </div>
        </div>
      `).join('');
    }

    function calcularHoraFinal(horaInicial, minutos) {
      if (!horaInicial) return '--:--';

      const [hora, minuto] = horaInicial.split(':').map(Number);
      const totalMinutos = hora * 60 + minuto + minutos;
      const novoHora = Math.floor(totalMinutos / 60) % 24;
      const novoMinuto = totalMinutos % 60;

      return `${String(novoHora).padStart(2, '0')}:${String(novoMinuto).padStart(2, '0')}`;
    }

    function formatarData(data) {
      if (!data) return '--/--/----';

      const [ano, mes, dia] = String(data).slice(0, 10).split('-');
      if (!ano || !mes || !dia) return data;

      const diasSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
      const diaSemana = new Date(Number(ano), Number(mes) - 1, Number(dia)).getDay();
      return `${dia}/${mes}/${ano} - ${diasSemana[diaSemana]}`;
    }

    function escaparHtml(valor) {
      return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[caractere]);
    }

    function obterChaveData(data) {
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const dia = String(data.getDate()).padStart(2, '0');
      return `${ano}-${mes}-${dia}`;
    }

    function renderizarCalendarioAdmin() {
      const titulo = document.getElementById('mesAtualAdmin');
      const grade = document.getElementById('diasCalendarioAdmin');
      const filtroData = document.getElementById('filtroData');
      if (!titulo || !grade || !filtroData) return;

      const ano = mesCalendarioAdmin.getFullYear();
      const mes = mesCalendarioAdmin.getMonth();
      const primeiroDia = new Date(ano, mes, 1).getDay();
      const totalDias = new Date(ano, mes + 1, 0).getDate();
      const datasComAgendamento = new Set(agendamentosCarregados.map(item => item.data_agendamento));
      const hoje = obterChaveData(new Date());

      titulo.textContent = new Date(ano, mes, 1).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
      });
      grade.innerHTML = '';

      for (let indice = 0; indice < primeiroDia; indice += 1) {
        grade.appendChild(document.createElement('span'));
      }

      for (let dia = 1; dia <= totalDias; dia += 1) {
        const data = new Date(ano, mes, dia);
        const chave = obterChaveData(data);
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'admin-calendar-day';
        botao.textContent = dia;
        botao.title = datasComAgendamento.has(chave) ? 'Ver agendamentos deste dia' : 'Nenhum agendamento neste dia';

        if (datasComAgendamento.has(chave)) botao.classList.add('has-appointments');
        if (chave === filtroData.value) botao.classList.add('selected');
        if (chave === hoje) botao.classList.add('today');

        botao.addEventListener('click', () => selecionarDataCalendarioAdmin(chave));
        grade.appendChild(botao);
      }
    }

    function selecionarDataCalendarioAdmin(data) {
      document.getElementById('filtroData').value = data;
      renderizarCalendarioAdmin();
      renderizarAgendamentos();
    }

    function mudarMesCalendarioAdmin(movimento) {
      mesCalendarioAdmin = new Date(
        mesCalendarioAdmin.getFullYear(),
        mesCalendarioAdmin.getMonth() + movimento,
        1
      );
      renderizarCalendarioAdmin();
    }

    function calcularTempoServico(servicoTipo) {
      const config = carregarConfiguracaoServicos();
      return String(servicoTipo || 'Lavagem Simples')
        .split(',')
        .map(servico => servico.trim())
        .reduce((total, servico) => total + (Number(config[servico]) || 40), 0);
    }

    function obterAgendamentosFiltrados() {
      const busca = document.getElementById('filtroBusca').value.trim().toLowerCase();
      const status = document.getElementById('filtroStatus').value;
      const data = document.getElementById('filtroData').value;

      return agendamentosCarregados.filter(item => {
        const texto = [item.cliente_nome, item.cliente_telefone, item.modelo_carro, item.placa_carro, item.servico_tipo]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return (!busca || texto.includes(busca))
          && (!status || item.status === status)
          && (!data || item.data_agendamento === data);
      });
    }

    function atualizarContadorResultados(total) {
      const totalGeral = agendamentosCarregados.length;
      document.getElementById('contadorResultados').textContent = total === totalGeral
        ? `${total} agendamento${total === 1 ? '' : 's'} encontrado${total === 1 ? '' : 's'}`
        : `${total} de ${totalGeral} agendamento${totalGeral === 1 ? '' : 's'} exibido${totalGeral === 1 ? '' : 's'}`;
    }

    function atualizarResumoCards(data) {
      const totalAgendados = document.getElementById('totalAgendados');
      const totalLavando = document.getElementById('totalLavando');
      const totalConcluidos = document.getElementById('totalConcluidos');

      totalAgendados.textContent = data.length;
      totalLavando.textContent = data.filter(item => item.status === 'Em Lavagem').length;
      totalConcluidos.textContent = data.filter(item => item.status === 'Pronto' || item.status === 'Finalizado').length;
    }

    function obterIntervaloRendimento() {
      const periodo = document.getElementById('periodoRendimento').value;
      const referencia = document.getElementById('dataRendimento').value || obterChaveData(new Date());
      const [ano, mes, dia] = referencia.split('-').map(Number);
      const dataReferencia = new Date(ano, mes - 1, dia);
      let inicio = new Date(dataReferencia);
      let fim = new Date(dataReferencia);

      if (periodo === 'semana') {
        const diaSemana = dataReferencia.getDay();
        inicio.setDate(dataReferencia.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
        fim = new Date(inicio);
        fim.setDate(inicio.getDate() + 6);
      }

      if (periodo === 'mes') {
        inicio = new Date(ano, mes - 1, 1);
        fim = new Date(ano, mes, 0);
      }

      return {
        periodo,
        inicio: obterChaveData(inicio),
        fim: obterChaveData(fim),
        texto: `${formatarData(obterChaveData(inicio))} até ${formatarData(obterChaveData(fim))}`
      };
    }

    function obterLinhasRendimentoLocais(inicio, fim) {
      const linhas = new Map();

      agendamentosCarregados
        .filter(item => item.data_agendamento >= inicio && item.data_agendamento <= fim)
        .forEach(item => {
          if (!linhas.has(item.data_agendamento)) {
            linhas.set(item.data_agendamento, {
              dia: item.data_agendamento,
              total_agendamentos: 0,
              carros_concluidos: 0,
              carros_em_lavagem: 0,
              carros_prontos: 0,
              minutos_concluidos: 0,
              valor_concluido: 0,
              clientes_concluidos: new Set()
            });
          }

          const linha = linhas.get(item.data_agendamento);
          linha.total_agendamentos += 1;
          if (item.status === 'Finalizado') {
            linha.carros_concluidos += 1;
            linha.minutos_concluidos += Number(item.tempo_estimado) || calcularTempoServico(item.servico_tipo);
            linha.valor_concluido += calcularValorAgendamento(item.servico_tipo, item.valor_estimado);
            if (item.cliente_telefone) linha.clientes_concluidos.add(item.cliente_telefone);
          }
          if (item.status === 'Em Lavagem') linha.carros_em_lavagem += 1;
          if (item.status === 'Pronto') linha.carros_prontos += 1;
        });

      return [...linhas.values()].map(linha => ({
        ...linha,
        clientes_concluidos: linha.clientes_concluidos.size
      }));
    }

    function formatarDuracao(minutos) {
      return ConfiguracaoServicos.formatarHoras(minutos);
    }

    function calcularValorAgendamento(servicoTipo, valorSalvo) {
      if (valorSalvo !== null && valorSalvo !== undefined && Number.isFinite(Number(valorSalvo))) {
        return Number(valorSalvo);
      }

      return String(servicoTipo || '')
        .split(',')
        .map(servico => servico.trim())
        .reduce((total, servico) => total + (VALORES_SERVICOS_ADMIN[servico] || 0), 0);
    }

    function formatarMoeda(valor) {
      return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function renderizarRelatorioRendimento(linhas, intervalo) {
      const linhasOrdenadas = [...linhas].sort((a, b) => a.dia.localeCompare(b.dia));
      const valoresPorDia = new Map();
      agendamentosCarregados
        .filter(item => item.data_agendamento >= intervalo.inicio && item.data_agendamento <= intervalo.fim && item.status === 'Finalizado')
        .forEach(item => {
          valoresPorDia.set(item.data_agendamento, (valoresPorDia.get(item.data_agendamento) || 0) + calcularValorAgendamento(item.servico_tipo, item.valor_estimado));
        });
      linhasOrdenadas.forEach(linha => {
        linha.valor_concluido = valoresPorDia.has(linha.dia)
          ? valoresPorDia.get(linha.dia)
          : Number(linha.valor_concluido || 0);
      });
      const concluidos = linhasOrdenadas.reduce((total, linha) => total + Number(linha.carros_concluidos || 0), 0);
      const agendamentos = linhasOrdenadas.reduce((total, linha) => total + Number(linha.total_agendamentos || 0), 0);
      const minutos = linhasOrdenadas.reduce((total, linha) => total + Number(linha.minutos_concluidos || 0), 0);
      const clientes = linhasOrdenadas.reduce((total, linha) => total + Number(linha.clientes_concluidos || 0), 0);
      const faturamento = linhasOrdenadas.reduce((total, linha) => total + Number(linha.valor_concluido || 0), 0);

      document.getElementById('periodoRendimentoTexto').textContent = intervalo.texto;
      document.getElementById('rendimentoCarros').textContent = concluidos;
      document.getElementById('rendimentoAgendamentos').textContent = agendamentos;
      document.getElementById('rendimentoHoras').textContent = formatarDuracao(minutos);
      document.getElementById('rendimentoClientes').textContent = clientes;
      document.getElementById('rendimentoFaturamento').textContent = formatarMoeda(faturamento);

      const grafico = document.getElementById('graficoRendimento');
      const maiorValor = Math.max(...linhasOrdenadas.map(linha => Number(linha.carros_concluidos || 0)), 1);
      grafico.innerHTML = linhasOrdenadas.length
        ? linhasOrdenadas.map(linha => {
          const altura = Math.max(8, (Number(linha.carros_concluidos || 0) / maiorValor) * 100);
          return `
            <div class="flex min-w-8 flex-col items-center justify-end gap-1 text-center" title="${escaparHtml(formatarData(linha.dia))}: ${linha.carros_concluidos} concluídos">
              <span class="text-base font-bold text-emerald-300">${linha.carros_concluidos}</span>
              <span class="w-full rounded-t-md bg-emerald-500/70" style="height: ${altura}%"></span>
              <span class="text-base text-slate-500">${linha.dia.slice(8, 10)}/${linha.dia.slice(5, 7)}</span>
            </div>`;
        }).join('')
        : '<p class="col-span-full self-center text-center text-base text-slate-500">Nenhum dado neste período.</p>';

      const servicos = new Map();
      agendamentosCarregados
        .filter(item => item.data_agendamento >= intervalo.inicio && item.data_agendamento <= intervalo.fim && item.status === 'Finalizado')
        .forEach(item => {
          String(item.servico_tipo || 'Serviço não informado').split(',').forEach(servico => {
            const nome = servico.trim();
            servicos.set(nome, (servicos.get(nome) || 0) + 1);
          });
        });

      const servicosOrdenados = [...servicos.entries()].sort((a, b) => b[1] - a[1]);
      const maiorServico = Math.max(...servicosOrdenados.map(servico => servico[1]), 1);
      document.getElementById('servicosRendimento').innerHTML = servicosOrdenados.length
        ? servicosOrdenados.map(([nome, total]) => `
          <div>
            <div class="mb-1 flex justify-between gap-3 text-base">
              <span class="truncate text-slate-300">${escaparHtml(nome)}</span>
              <strong class="text-emerald-300">${total}</strong>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div class="h-full rounded-full bg-emerald-500" style="width: ${(total / maiorServico) * 100}%"></div>
            </div>
          </div>`).join('')
        : '<p class="text-base text-slate-500">Nenhum serviço concluído neste período.</p>';

      document.getElementById('tabelaRendimento').innerHTML = linhasOrdenadas.length
        ? linhasOrdenadas.map(linha => `
          <tr class="transition hover:bg-slate-800/60">
            <td class="p-3 font-semibold text-white">${escaparHtml(formatarData(linha.dia))}</td>
            <td class="p-3 text-emerald-300">${linha.carros_concluidos}</td>
            <td class="p-3">${linha.total_agendamentos}</td>
            <td class="p-3">${formatarDuracao(linha.minutos_concluidos)}</td>
            <td class="p-3">${linha.clientes_concluidos}</td>
            <td class="p-3 font-semibold text-violet-300">${formatarMoeda(linha.valor_concluido)}</td>
          </tr>`).join('')
        : '<tr><td colspan="6" class="p-8 text-center text-slate-500">Nenhum dado neste período.</td></tr>';
    }

    async function carregarRelatorioRendimento() {
      const intervalo = obterIntervaloRendimento();
      const { data, error } = await supabaseClient
        .from('rendimento_diario_agendamentos')
        .select('*')
        .gte('dia', intervalo.inicio)
        .lte('dia', intervalo.fim)
        .order('dia', { ascending: true });

      renderizarRelatorioRendimento(error ? obterLinhasRendimentoLocais(intervalo.inicio, intervalo.fim) : (data || []), intervalo);
    }

    function obterClasseStatus(status) {
      if (status === 'Em Lavagem') return 'status-em-lavagem';
      if (status === 'Pronto') return 'status-pronto';
      if (status === 'Finalizado') return 'status-finalizado';
      return 'status-aguardando';
    }

    function obterIconeStatus(status) {
      if (status === 'Em Lavagem') return '🧼';
      if (status === 'Pronto') return '✅';
      if (status === 'Finalizado') return '🏁';
      return '⏳';
    }

    function renderizarAgendamentos() {
      document.dispatchEvent(new Event('admin:filters-updated'));
      const corpo = document.getElementById('tabelaCorpo');
      const agendamentosFiltrados = obterAgendamentosFiltrados();
      atualizarResumoCards(agendamentosFiltrados);
      atualizarContadorResultados(agendamentosFiltrados.length);

      if (agendamentosFiltrados.length === 0) {
        corpo.innerHTML = `<div class="p-8 text-center text-slate-500">${agendamentosCarregados.length ? 'Nenhum agendamento corresponde aos filtros.' : 'Nenhum agendamento encontrado.'}</div>`;
        return;
      }

      corpo.innerHTML = '';
      const gruposPorData = new Map();

      agendamentosFiltrados.forEach(item => {
        if (!gruposPorData.has(item.data_agendamento)) gruposPorData.set(item.data_agendamento, []);
        gruposPorData.get(item.data_agendamento).push(item);
      });

      [...gruposPorData.entries()].forEach(([data, itensDoDia]) => {
        const grupo = document.createElement('section');
        grupo.className = 'admin-day-group';
        grupo.innerHTML = `
          <header class="admin-day-title">${formatarData(data)}</header>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Cliente</th>
                  <th>Veículo</th>
                  <th>Serviço</th>
                  <th>Busca</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        `;
        corpo.appendChild(grupo);

        const corpoTabela = grupo.querySelector('tbody');

        itensDoDia
          .slice()
          .sort((primeiro, segundo) => String(primeiro.horario_agendamento || '').localeCompare(String(segundo.horario_agendamento || '')))
          .forEach(item => {
            const enderecoCompleto = item.endereco_busca ? String(item.endereco_busca).trim() : '';
            const [enderecoParte, observacaoParte] = enderecoCompleto
              .split(/\s*\|\s*Observação:\s*/i)
              .map(parte => (parte || '').trim());

            const enderecoHtml = enderecoParte
              ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoParte + ', Sertãozinho - SP')}" target="_blank" rel="noopener noreferrer" class="block max-w-[180px] whitespace-normal break-words text-base leading-snug text-sky-300 underline decoration-dotted underline-offset-2 transition hover:text-sky-200">📍 ${escaparHtml(enderecoParte)}</a>`
              : `<span class="block text-base text-slate-500">Não</span>`;

            const observacaoHtml = observacaoParte
              ? `<span class="block max-w-[180px] whitespace-normal break-words text-base leading-snug text-amber-300">📝 ${escaparHtml(observacaoParte)}</span>`
              : '';

            const tempoEstimado = Number(item.tempo_estimado) || calcularTempoServico(item.servico_tipo);
            const horarioFim = item.horario_fim || calcularHoraFinal(item.horario_agendamento, tempoEstimado);
            const servicoExibicao = item.servico_tipo || 'Serviço não informado';
            const servicosHtml = servicoExibicao
              .split(',')
              .map(servico => `<span class="service-item">${escaparHtml(servico.trim())}</span>`)
              .join('');

            const linha = document.createElement('tr');
            linha.innerHTML = `
              <td data-label="Horário" class="admin-time-cell">
                ${item.horario_agendamento}
                <span class="cell-secondary">fim ${horarioFim} · ${ConfiguracaoServicos.formatarHoras(tempoEstimado)}</span>
              </td>
              <td data-label="Cliente">
                <span class="block font-medium text-white">${escaparHtml(item.cliente_nome)}</span>
                <span class="cell-secondary">${escaparHtml(item.cliente_telefone)}</span>
              </td>
              <td data-label="Veículo">
                <span class="block text-white">${escaparHtml(item.modelo_carro)}</span>
                <span class="cell-secondary">${escaparHtml(item.placa_carro || 'Sem placa')}</span>
              </td>
              <td data-label="Serviço">
                <div class="service-list">${servicosHtml}</div>
              </td>
              <td data-label="Busca">
                ${item.precisa_buscar ? enderecoHtml + observacaoHtml : '<span class="block text-base text-slate-500">Não</span>'}
              </td>
              <td data-label="Status">
                <span class="status-badge ${obterClasseStatus(item.status)}">${obterIconeStatus(item.status)} ${escaparHtml(item.status)}</span>
              </td>
              <td data-label="Ações">
                <div class="admin-actions-cell">
                  <select data-status-id="${item.id}">
                    <option value="Aguardando" ${item.status === 'Aguardando' ? 'selected' : ''}>⏳ Aguardando</option>
                    <option value="Em Lavagem" ${item.status === 'Em Lavagem' ? 'selected' : ''}>🧼 Em Lavagem</option>
                    <option value="Pronto" ${item.status === 'Pronto' ? 'selected' : ''}>✅ Pronto</option>
                    <option value="Finalizado" ${item.status === 'Finalizado' ? 'selected' : ''}>🏁 Finalizado</option>
                  </select>
                  <div class="actions-row">
                    <button type="button" title="Enviar aviso pelo WhatsApp" data-whatsapp-id="${item.id}" class="bg-emerald-600 text-white hover:bg-emerald-500">💬 Aviso</button>
                    <button type="button" title="Eliminar agendamento" data-delete-id="${item.id}" class="bg-red-500/10 text-red-300 hover:bg-red-500/20">Eliminar</button>
                  </div>
                </div>
              </td>
            `;

            linha.querySelector('[data-status-id]').addEventListener('change', async event => {
              const id = event.target.dataset.statusId;
              const novoStatus = event.target.value;

              const atualizouComSucesso = await atualizarStatus(id, novoStatus);

              if (atualizouComSucesso) {
                enviarWhatsappAgendamento(id);
              }
            });

            linha.querySelector('[data-whatsapp-id]').addEventListener('click', () => {
              enviarWhatsappAgendamento(item.id);
            });
            linha.querySelector('[data-delete-id]').addEventListener('click', () => {
              eliminarAgendamento(item.id);
            });

            corpoTabela.appendChild(linha);
          });
      });
    }

    let carregamentoAgendaEmAndamento = false;
    async function carregarAgendamentos() {
      if (carregamentoAgendaEmAndamento) return;
      carregamentoAgendaEmAndamento = true;
      try {
      const corpo = document.getElementById('tabelaCorpo');
      const cache = carregarCacheAgendamentos();

      if (!agendamentosCarregados.length && cache) {
        agendamentosCarregados = cache;
        renderizarCalendarioAdmin();
        renderizarAgendamentos();
      } else if (!agendamentosCarregados.length) {
        corpo.innerHTML = '<div class="p-8 text-center text-slate-500">A carregar...</div>';
      }

      const { data, error } = await supabaseClient
        .from('agendamentos')
        .select('*')
        .order('data_agendamento', { ascending: true })
        .order('horario_agendamento', { ascending: true });

      if (error) {
        atualizarStatusSincronizacao('Não foi possível atualizar. Tente novamente.', false);
        if (!agendamentosCarregados.length) {
          corpo.innerHTML = `<div class="p-8 text-center text-red-400">Erro ao carregar: ${escaparHtml(error.message)}</div>`;
        }
        return;
      }

      window.conferirNovosAgendamentos?.(data || []);
      agendamentosCarregados = data || [];
      salvarCacheAgendamentos();
      renderizarCalendarioAdmin();
      renderizarAgendamentos();
      } finally { carregamentoAgendaEmAndamento = false; }
    }

    function ordenarAgendamentos() {
      agendamentosCarregados.sort((primeiro, segundo) => {
        const dataPrimeiro = `${primeiro.data_agendamento || ''} ${primeiro.horario_agendamento || ''}`;
        const dataSegundo = `${segundo.data_agendamento || ''} ${segundo.horario_agendamento || ''}`;
        return dataPrimeiro.localeCompare(dataSegundo);
      });
    }

    function atualizarStatusSincronizacao(mensagem, conectado) {
      const indicador = document.getElementById('statusSincronizacao');
      if (!indicador) return;

      indicador.textContent = mensagem;
      indicador.className = conectado
        ? 'mt-2 w-max rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-base font-semibold text-emerald-300'
        : 'mt-2 w-max rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-base font-semibold text-amber-300';
    }

    function assinarAtualizacoesAgendamentos() {
      canalAgendamentos = supabaseClient
        .channel('agendamentos-painel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const jaExiste = agendamentosCarregados.some(item => item.id === payload.new.id);
            if (!jaExiste) agendamentosCarregados.push(payload.new);
            window.avisarNovoAgendamento?.(payload.new);
          }

          if (payload.eventType === 'UPDATE') {
            const indice = agendamentosCarregados.findIndex(item => item.id === payload.new.id);
            if (indice >= 0) agendamentosCarregados[indice] = payload.new;
            else agendamentosCarregados.push(payload.new);
          }

          if (payload.eventType === 'DELETE') {
            agendamentosCarregados = agendamentosCarregados.filter(item => item.id !== payload.old.id);
          }

          ordenarAgendamentos();
          salvarCacheAgendamentos();
          renderizarCalendarioAdmin();
          renderizarAgendamentos();
          if (!document.getElementById('visaoRendimento').classList.contains('hidden')) {
            carregarRelatorioRendimento();
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            atualizarStatusSincronizacao('Painel sincronizado ao vivo', true);
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            atualizarStatusSincronizacao('Reconectando sincronização...', false);
            setTimeout(() => {
              if (canalAgendamentos) supabaseClient.removeChannel(canalAgendamentos);
              assinarAtualizacoesAgendamentos();
            }, 3000);
          }
        });
    }

    async function atualizarStatus(id, novoStatus) {
      const { error } = await supabaseClient
        .from('agendamentos')
        .update({ status: novoStatus })
        .eq('id', id);

      if (error) {
        alert('Erro ao atualizar status: ' + error.message);
        return false;
      } else {
        const agendamento = agendamentosCarregados.find(item => item.id === id);
        if (agendamento) agendamento.status = novoStatus;
        salvarCacheAgendamentos();
        renderizarAgendamentos();
        return true;
      }
    }

    function enviarWhatsapp(nome, telefone, modelo, status) {
      const telefoneLimpo = telefone.replace(/\D/g, '');
      let mensagem = '';

      if (status === 'Em Lavagem') {
        mensagem = `Olá ${nome}! O seu ${modelo} já começou a ser lavado na ARD CENTRAL Lava-Jato! <span>😀</span>`;
      } else if (status === 'Pronto') {
        mensagem = `Boas notícias, ${nome}! O seu ${modelo} está prontinho e brilhando! 🚗✨`;
      } else if (status === 'Finalizado') {
        mensagem = `Serviço concluído! Muito obrigado pela preferência, ${nome}! `;
      } else {
        mensagem = `Olá ${nome}! Seu agendamento para o ${modelo} está confirmado no ARD CENTRAL Lava-Jato. 📅`;
      }

      if (telefoneLimpo) {
        window.open(`https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`, '_blank');
      } else {
        alert('Número de telefone inválido!');
      }
    }

    function enviarWhatsappAgendamento(id) {
      const agendamento = agendamentosCarregados.find(item => item.id === id);
      if (!agendamento) return;

      enviarWhatsapp(
        agendamento.cliente_nome,
        agendamento.cliente_telefone,
        agendamento.modelo_carro,
        agendamento.status
      );
    }

    async function eliminarAgendamento(id) {
      if (!confirm('Tem a certeza que deseja eliminar este agendamento?')) return;

      const agendamento = agendamentosCarregados.find(item => item.id === id);
      const telefoneLimpo = agendamento?.cliente_telefone ? String(agendamento.cliente_telefone).replace(/\D/g, '') : '';
      const janelaWhatsapp = telefoneLimpo ? window.open('about:blank', '_blank') : null;

      const { error } = await supabaseClient
        .from('agendamentos')
        .delete()
        .eq('id', id);

      if (error) {
        if (janelaWhatsapp) janelaWhatsapp.close();
        alert('Erro ao eliminar: ' + error.message);
      } else {
        agendamentosCarregados = agendamentosCarregados.filter(item => item.id !== id);
        salvarCacheAgendamentos();
        renderizarCalendarioAdmin();
        renderizarAgendamentos();

        if (agendamento && telefoneLimpo) {
          const mensagem = `Olá ${agendamento.cliente_nome}! Infelizmente, não poderemos realizar a lavagem do seu ${agendamento.modelo_carro} nesta data. Pedimos desculpas pelo transtorno. Entre em contato conosco para agendarmos uma nova data. ARD CENTRAL Lava-Jato.`;
          janelaWhatsapp.location.href = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagem)}`;
        } else if (janelaWhatsapp) {
          janelaWhatsapp.close();
        }
      }
    }

    document.getElementById('configuracoesServicos').addEventListener('input', event => {
      if (event.target.matches('input[data-servico]')) event.target.dataset.editado = 'true';
    });

    document.getElementById('salvarTempoServicos').addEventListener('click', async (event) => {
      const botao = event.currentTarget;
      const novaConfig = {};
      botao.disabled = true;
      try {
        document.querySelectorAll('#configuracoesServicos input[data-servico]').forEach(input => {
          const minutos = ConfiguracaoServicos.horasParaMinutos(input.value);
          if (minutos !== carregarConfiguracaoServicos()[input.dataset.servico]) novaConfig[input.dataset.servico] = minutos;
        });
        await servicosBanco.salvar(novaConfig);
        renderizarConfiguracaoServicos();
        alert('Durações atualizadas com sucesso!');
        carregarAgendamentos();
      } catch (erro) {
        alert(erro.message || 'Não foi possível salvar as durações.');
      } finally {
        botao.disabled = false;
      }
    });

    let buscaAgendamentoTimer;

    ['filtroBusca', 'filtroStatus', 'filtroData'].forEach((id) => {
      document.getElementById(id).addEventListener('input', () => {
        if (id === 'filtroData') renderizarCalendarioAdmin();

        if (id === 'filtroBusca') {
          clearTimeout(buscaAgendamentoTimer);
          buscaAgendamentoTimer = setTimeout(renderizarAgendamentos, 120);
        } else {
          renderizarAgendamentos();
        }
      });
    });

    document.getElementById('mesAnteriorAdmin').addEventListener('click', () => mudarMesCalendarioAdmin(-1));
    document.getElementById('proximoMesAdmin').addEventListener('click', () => mudarMesCalendarioAdmin(1));

    document.getElementById('limparFiltros').addEventListener('click', () => {
      document.getElementById('filtroBusca').value = '';
      document.getElementById('filtroStatus').value = '';
      document.getElementById('filtroData').value = '';
      renderizarCalendarioAdmin();
      renderizarAgendamentos();
    });

    function ativarAba(abaAtiva) {
      const abas = [
        ['operacao', 'abaOperacao', 'visaoOperacao'],
        ['rendimento', 'abaRendimento', 'visaoRendimento'],
        ['configuracoes', 'abaConfiguracoes', 'visaoConfiguracoes']
      ];
      abas.forEach(([nome, botaoId, visaoId]) => {
        const ativa = nome === abaAtiva;
        const botao = document.getElementById(botaoId);
        document.getElementById(visaoId).classList.toggle('hidden', !ativa);
        botao.className = ativa
          ? 'flex-1 rounded-xl bg-gradient-to-r from-[var(--ard-blue)] to-[var(--ard-red)] px-3 py-3 text-base font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-900/30 transition hover:brightness-110'
          : 'flex-1 rounded-xl px-3 py-3 text-base font-bold uppercase tracking-wide text-slate-400 transition hover:bg-slate-700/60 hover:text-white';
        botao.setAttribute('aria-selected', String(ativa));
        botao.setAttribute('aria-pressed', String(ativa));
        botao.setAttribute('aria-controls', visaoId);
      });
      if (abaAtiva === 'rendimento') carregarRelatorioRendimento();
    }

    document.getElementById('abaConfiguracoes').addEventListener('click', () => ativarAba('configuracoes'));
    document.getElementById('abaOperacao').addEventListener('click', () => ativarAba('operacao'));
    document.getElementById('abaRendimento').addEventListener('click', () => ativarAba('rendimento'));
    document.getElementById('periodoRendimento').addEventListener('change', carregarRelatorioRendimento);
    document.getElementById('dataRendimento').addEventListener('change', carregarRelatorioRendimento);
    document.getElementById('dataRendimento').value = obterChaveData(new Date());

    renderizarConfiguracaoServicos();
    renderizarCalendarioAdmin();
    carregarAgendamentos();
    assinarAtualizacoesAgendamentos();
    servicosBanco.iniciar();
    // Recover new bookings even when Realtime is unavailable or disconnected.
    setInterval(() => { void carregarAgendamentos().catch(() => atualizarStatusSincronizacao('Falha ao atualizar agenda. Tentando novamente...', false)); }, 15000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void carregarAgendamentos().catch(() => atualizarStatusSincronizacao('Falha ao atualizar agenda.', false));
    });

document.getElementById('dataPainel').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
