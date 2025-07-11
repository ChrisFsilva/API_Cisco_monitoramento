import xapi from 'xapi';
 
// Função segura para buscar status
function getSafe(path) {
  return xapi.status.get(path).catch(() => null);
}
 
// Função para verificar conectividade com a internet
async function verificarConectividadeHttp() {
  try {
    await xapi.command('HttpClient.Get', {
      Url: 'https://www.microsoft.com',
      AllowInsecureHTTPS: true
    });
    return {
      sucesso: true,
      mensagem: 'Conectividade HTTP ativa'
    };
  } catch (error) {
    return {
      sucesso: false,
      mensagem: `Falha de rede ou bloqueio: ${error.message}`
    };
  }
}
 
// 🔍 Função para organizar canais por tipo e direção com dados de qualidade
async function getQualidadeMediaChannels() {
  const canais = await getSafe('MediaChannels');
  if (!Array.isArray(canais)) return null;
 
  // Estrutura para armazenar dados separados
  const resultado = {
    video: { incoming: [], outgoing: [] },
    audio: { incoming: [], outgoing: [] },
    presentation: { incoming: [], outgoing: [] }
  };
 
  // Itera pelos canais para separar e coletar info
  canais.forEach(canal => {
    const tipo = canal.Type?.toLowerCase();
    const direcao = canal.Direction?.toLowerCase();
 
    if (!tipo || !direcao) return; // descarta canais inválidos
 
    // Só considerar Video, Audio e Presentation
    if (['video', 'audio', 'presentation'].includes(tipo)) {
      // Montar objeto com dados relevantes, cuidado com campos opcionais
      const dadosCanal = {
        ChannelRole: canal.Video?.ChannelRole || canal.Audio?.ChannelRole || canal.Presentation?.ChannelRole || 'Desconhecido',
        ResolutionX: canal.Video?.ResolutionX ?? null,
        ResolutionY: canal.Video?.ResolutionY ?? null,
        FrameRate: canal.Video?.FrameRate ?? null,
        Packets: canal.Netstat?.Packets ?? null,
        Loss: canal.Netstat?.Loss ?? null,
        Jitter: canal.Netstat?.Jitter ?? null,
        EndToEndDelay: canal.Netstat?.EndToEndDelay ?? null,
        Codec: canal.Video?.Codec || canal.Audio?.Codec || canal.Presentation?.Codec || 'Desconhecido',
        Bitrate: canal.Video?.Bitrate || canal.Audio?.Bitrate || canal.Presentation?.Bitrate || null
      };
 
      resultado[tipo][direcao].push(dadosCanal);
    }
  });
 
  return resultado;
}
 
// 🔍 Verifica status físico dos microfones no início
let microfoneFuncional = false;
(async () => {
  const microfones = await getSafe('Audio/Microphones');
  if (Array.isArray(microfones)) {
    microfoneFuncional = microfones.some(mic =>
      mic.Connected === 'True' && mic.Availability === 'Available'
    );
  }
})();
 
// 🔁 Executa a cada 60 segundos
setInterval(async () => {
  try {
    const calls = await getSafe('Call');
    const emChamada = Array.isArray(calls) && calls.length > 0;
 
    const pessoas = await getSafe('RoomAnalytics/PeopleCount/Current');
    const ip = await getSafe('Network/IPv4/Address');
    const gateway = await getSafe('Network/IPv4/Gateway');
    const dns = await getSafe('Network/DNS/Server/1/Address');
    const camera = await getSafe('Video/Input/MainVideoActive');
    const tablet = await getSafe('Peripherals/ConnectedDevice/1/Name');
 
    const redeHttp = await verificarConectividadeHttp();
    const qualidadeMedia = emChamada ? await getQualidadeMediaChannels() : null;
 
    const dados = {
      sala: 'Latitude',
      unidade: 'Cenu',
      emChamada,
      pessoasNaSala: pessoas ?? 'Indefinido',
      ip: ip ?? 'Desconhecido',
      gateway: gateway ?? 'Desconhecido',
      dns: dns ?? 'Desconhecido',
      cameraAtiva: camera === 'True',
      microfoneFuncional: microfoneFuncional,
      tabletConectado: tablet ?? 'Não detectado',
      conectividadeHttp: redeHttp,
      horario: new Date().toISOString(),
      qualidadeMedia: qualidadeMedia ?? 'Sem canais ativos'
    };
 
    const webhookUrl = 'https://prod-20.brazilsouth.logic.azure.com:443/workflows/f5adf7c826ca4d9ba9ddd7b49dd5a79d/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=tXl2JyhlE0M5dOyR1vCzeSYWYhyJUXSDY6FbSry8fmg';
 
    xapi.command('HttpClient.Post', {
      Url: webhookUrl,
      Header: ['Content-Type: application/json'],
      AllowInsecureHTTPS: true
    }, JSON.stringify(dados));
 
    console.log('✅ Dados enviados com sucesso:', dados);
 
  } catch (e) {
    console.log('❌ Erro geral na macro:', e.message);
  }
}, 60000);
