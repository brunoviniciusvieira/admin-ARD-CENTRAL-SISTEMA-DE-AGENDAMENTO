(function (global) {
  'use strict';

  // Mantém os tempos anteriores até que o administrador escolha novos valores.
  const PADRAO = Object.freeze({
    'Lavagem de moto simples': 60,
    'Lavagem de moto com cera': 60,
    'Lavagem Simples': 40,
    'Lavagem Simples com Cera': 40,
    'Lavagem Completa': 40,
    'Ducha externa': 40,
    'Limpeza interna': 40,
    'Lavagem de motor': 40,
    'Lavagem de chassi': 40,
    'Polimento': 40,
    'Cristalização': 40,
    'Higienização': 40,
    'Higienização do ar condicionado': 40,
    'Troca do filtro de ar': 40,
    'Troca do filtro do motor': 40,
    'Hidratação em bancos de couro': 40,
    'Descontaminação de vidros': 40,
    'Descontaminação da pintura': 40,
    'Estacionamento avulso': 40,
    'Estacionamento mensal moto': 40,
    'Estacionamento mensal carro': 40,
    'Lavagem Simples - Caminhonete Cabine Simples': 40,
    'Lavagem Simples com Cera - Caminhonete Cabine Simples': 40,
    'Lavagem Simples - Caminhonete Cabine Dupla': 40,
    'Lavagem Simples com Cera - Caminhonete Cabine Dupla': 40,
    'Lavagem Simples - Van': 40,
    'Lavagem Simples com Cera - Van': 40,
    'Completa + Aritana': 60,
    'Polimento + Cera': 90
  });

  function duracaoValida(valor) {
    return Number.isInteger(valor) && valor >= 15 && valor <= 1440 && valor % 5 === 0;
  }

  function horasParaMinutos(horas) {
    const valor = Number(String(horas).replace(',', '.')) * 60;
    const minutos = Math.round(valor);
    if (Math.abs(valor - minutos) > 0.0001 || !duracaoValida(minutos)) {
      throw new Error('Informe uma duração entre 0,25 e 24 horas, em frações de 1/12 de hora. Ex.: 1 ou 1,5.');
    }
    return minutos;
  }

  function minutosParaHoras(minutos) {
    return Number((Number(minutos) / 60).toFixed(6));
  }

  function formatarHoras(minutos) {
    return `${(Number(minutos) / 60).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`;
  }

  function criar(cliente, opcoes = {}) {
    let configuracao = { ...PADRAO };
    let carregado = false;
    let consulta = null;
    let gravacao = null;
    let iniciado = false;

    function aplicar(linhas, completa) {
      const nova = completa ? {} : { ...configuracao };
      for (const linha of linhas || []) {
        if (!Object.prototype.hasOwnProperty.call(PADRAO, linha.nome)) continue;
        if (!duracaoValida(linha.duracao_minutos)) {
          throw new Error('Existe um tempo de serviço inválido no banco de dados.');
        }
        nova[linha.nome] = linha.duracao_minutos;
      }
      if (Object.keys(PADRAO).some(nome => !Object.prototype.hasOwnProperty.call(nova, nome))) {
        throw new Error('A configuração de serviços está incompleta. Execute a migração de serviços no Supabase.');
      }
      configuracao = nova;
      carregado = true;
      if (opcoes.aoAtualizar) opcoes.aoAtualizar({ ...configuracao });
      return { ...configuracao };
    }

    function notificarErro(erro) {
      if (opcoes.aoErro) opcoes.aoErro(erro);
    }

    function consultar() {
      if (consulta) return consulta;
      consulta = (async () => {
        try {
          const { data, error } = await cliente.from('configuracoes_servicos').select('nome,duracao_minutos');
          if (error) throw error;
          return aplicar(data, true);
        } catch (erro) {
          notificarErro(erro);
          throw erro;
        } finally {
          consulta = null;
        }
      })();
      return consulta;
    }

    async function atualizar() {
      // Uma mudança recebida durante outra operação exige uma leitura posterior.
      if (gravacao) await gravacao;
      if (consulta) await consulta;
      return consultar();
    }

    async function salvar(alteracoes) {
      const linhas = Object.entries(alteracoes).map(([nome, duracao]) => {
        if (!Object.prototype.hasOwnProperty.call(PADRAO, nome) || !duracaoValida(duracao)) {
          throw new Error('Informe durações entre 0,25 e 24 horas, em frações de 1/12 de hora.');
        }
        return { nome, duracao_minutos: duracao };
      });
      if (!linhas.length) return { ...configuracao };
      if (gravacao) throw new Error('Aguarde o salvamento em andamento.');
      gravacao = (async () => {
        try {
          // Adquire a trava antes de aguardar e finaliza leituras anteriores.
          await consulta;
          await consultar();
          const { data, error } = await cliente.from('configuracoes_servicos')
            .upsert(linhas, { onConflict: 'nome' }).select('nome,duracao_minutos');
          if (error) throw error;
          if (!data || linhas.some(linha => !data.some(salva => salva.nome === linha.nome && salva.duracao_minutos === linha.duracao_minutos))) {
            throw new Error('O banco não confirmou todos os tempos. Tente salvar novamente.');
          }
          return aplicar(data, false);
        } catch (erro) {
          notificarErro(erro);
          throw erro;
        } finally {
          gravacao = null;
        }
      })();
      return gravacao;
    }

    function iniciar() {
      if (iniciado) return;
      iniciado = true;
      const recarregar = () => { atualizar().catch(() => {}); };
      recarregar();
      cliente.channel('configuracoes-servicos')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_servicos' }, recarregar)
        .subscribe(status => { if (status === 'SUBSCRIBED') recarregar(); });
      // Recupera mudanças mesmo após suspensão do celular ou falha do Realtime.
      global.addEventListener('focus', recarregar);
      global.addEventListener('online', recarregar);
      global.document.addEventListener('visibilitychange', () => {
        if (!global.document.hidden) recarregar();
      });
      global.setInterval(() => { if (!global.document.hidden) recarregar(); }, 30000);
    }

    return {
      obter: () => ({ ...configuracao }),
      estaCarregado: () => carregado,
      atualizar,
      salvar,
      iniciar
    };
  }

  global.ConfiguracaoServicos = Object.freeze({ criar, duracaoValida, horasParaMinutos, minutosParaHoras, formatarHoras });
})(window);
