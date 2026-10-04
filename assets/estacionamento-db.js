(function (root) {
  'use strict';
  const TABLE = 'estacionamento_mensalistas';
  const FIELDS = 'id,name,phone,plate,car,start,days,version';
  function errorMessage(error) {
    if (['PGRST205','42P01'].includes(error.code)) return 'A estrutura do estacionamento ainda não foi criada no Supabase. Execute o SQL de instalação.';
    if (error.code === '23505') return 'Esta placa já está cadastrada no banco. Atualize a lista e edite o cadastro existente.';
    if (['42501','PGRST301','PGRST303'].includes(error.code)) return 'O banco não liberou o acesso ao estacionamento. Execute o SQL atualizado de instalação.';
    return error.message || 'Não foi possível acessar o banco. Verifique a conexão e tente novamente.';
  }
  function check(result) { if (result.error) throw new Error(errorMessage(result.error)); return result.data; }
  function create(client) {
    const validate = input => root.ParkingCore.validate(input);
    return {
      client,
      async list() {
        // Paginação evita perder silenciosamente registros acima do limite da API.
        const rows = [], size = 500;
        for (let offset = 0; ; offset += size) {
          const batch = check(await client.from(TABLE).select(FIELDS).order('id').range(offset,offset + size - 1));
          rows.push(...batch);
          if (batch.length < size) break;
        }
        return rows;
      },
      async insert(input) {
        const rows = check(await client.from(TABLE).insert(validate(input)).select(FIELDS));
        if (!rows || rows.length !== 1) throw new Error('O banco não confirmou o cadastro. Atualize a lista antes de tentar novamente.');
        return rows[0];
      },
      async update(original, input) {
        const rows = check(await client.from(TABLE).update(validate(input)).eq('id',original.id).eq('version',original.version).select(FIELDS));
        if (!rows || rows.length !== 1) throw new Error('Este cadastro foi alterado ou excluído em outro dispositivo. Atualize a lista e abra a edição novamente.');
        return rows[0];
      },
      async remove(original) {
        const rows = check(await client.from(TABLE).delete().eq('id',original.id).eq('version',original.version).select('id'));
        if (!rows || rows.length !== 1) throw new Error('Este cadastro foi alterado ou excluído em outro dispositivo. Atualize a lista antes de excluir.');
      },
      async importRows(rows) {
        const data = rows.map(validate);
        if (!data.length) return 0;
        // Uma única operação atômica; conflitos por placa preservam o cadastro remoto.
        const inserted = check(await client.from(TABLE).upsert(data,{onConflict:'plate',ignoreDuplicates:true}).select('id'));
        if (!inserted) throw new Error('O banco não confirmou a importação. Atualize a lista.');
        return inserted.length;
      },
      subscribe(refresh) {
        const channel = client.channel('ard-estacionamento')
          .on('postgres_changes',{event:'*',schema:'public',table:TABLE},refresh)
          .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
        return () => client.removeChannel(channel);
      }
    };
  }
  root.ParkingDatabase = {create,errorMessage};
})(typeof window !== 'undefined' ? window : globalThis);
