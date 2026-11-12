/* ============================================================
   lembretes-sdk.js — como um app envia lembretes para a Central
   ------------------------------------------------------------
   CONTRATO: cada app grava UM arquivo na pasta "Lembretes" do Drive,
   chamado  lembretes-<app>.json  (ex.: lembretes-consultorio.json).
   Nomes de app: consultorio, saude, bloco, bussola, financeiro,
   memoria, mercado.

   Conteúdo do arquivo:
   { "app":"saude", "atualizado":"2026-11-12T15:00:00Z",
     "itens":[
       { "id":"exame-12",            // único dentro do app, estável
         "titulo":"Coletar exames de sangue",
         "detalhe":"Jejum de 12h",   // opcional
         "quando":"2026-11-14T07:30",// "AAAA-MM-DDTHH:MM" (hora local) ou "AAAA-MM-DD" (vira 9h) ou null
         "categoria":"Exames",       // opcional
         "link":"https://rodripsi.github.io/saude/#exames", // opcional
         "privado":false }           // true = a Agenda mostra só "Lembrete"
     ] }

   Regras:
   - O app envia a LISTA COMPLETA dos lembretes ativos a cada gravação.
     Lembrete que sumiu da lista some da Central e da Agenda.
   - Quem marca "feito" ou adia é a Central (arquivo lembretes-central.json,
     campo "done"/"ate", chave "<app>:<id>"). O app de origem pode ler isso.
   - SIGILO (Consultório): não mande nome completo de paciente. Use "privado":true
     e título genérico (ex.: "Retomar assunto da ficha 14").
   - Use o MESMO ID de cliente Google em todos os apps.
   ============================================================ */
const Lembretes = {
  async _api(token, url, opt = {}) {
    const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + token, ...(opt.headers || {}) } });
    if (!r.ok) throw new Error('Drive ' + r.status);
    return r;
  },
  async _pasta(token) {
    const q = encodeURIComponent("name='Lembretes' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const j = await (await this._api(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`)).json();
    if (j.files && j.files[0]) return j.files[0].id;
    const c = await this._api(token, 'https://www.googleapis.com/drive/v3/files', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Lembretes', mimeType: 'application/vnd.google-apps.folder' })
    });
    return (await c.json()).id;
  },
  /** token: access_token do Google já usado pelo app (escopo drive.file) */
  async publicar(token, app, itens) {
    const pasta = await this._pasta(token), nome = `lembretes-${app}.json`;
    const q = encodeURIComponent(`name='${nome}' and '${pasta}' in parents and trashed=false`);
    const f = (await (await this._api(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`)).json()).files || [];
    const conteudo = JSON.stringify({ app, atualizado: new Date().toISOString(), itens });
    if (f[0]) return this._api(token, `https://www.googleapis.com/upload/drive/v3/files/${f[0].id}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: conteudo });
    const b = 'lemBND';
    return this._api(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b },
      body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: [pasta] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${conteudo}\r\n--${b}--`
    });
  }
};
// Exemplo no app Saúde:
// await Lembretes.publicar(tokenDoGoogle, 'saude', [
//   { id:'exame-12', titulo:'Coletar exames de sangue', quando:'2026-11-14T07:30', categoria:'Exames' }
// ]);
