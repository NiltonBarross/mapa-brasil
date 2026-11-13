// Exemplo de uso do BrasilMapa. Troque os arquivos de data/exemplo pelos seus dados.
(async function () {
  const json = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  const pct = BrasilMapa.FORMATOS.variacao, num = BrasilMapa.FORMATOS.numero;
  const [estados, dEstados, dMunicipios] = await Promise.all([json('data/geo/estados.json'), json('data/exemplo/estados.json'), json('data/exemplo/municipios.json')]);
  const METRICAS = {
    valor: {campo: 'valor', titulo: 'Lorem ipsum', escala: 'linear', paleta: 'sequencial', formato: 'compacto'},
    crescimento: {campo: 'crescimento', titulo: 'Dolor sit amet', escala: 'divergente', paleta: 'divergente', formato: 'variacao', campoNomes: 'valor'},
  };
  const evento = document.getElementById('evento');
  const mapa = BrasilMapa.criar('#mapa', {
    geo: {estados, municipios: (regiao) => json(`data/geo/municipios_${regiao}.json`)},
    dados: {estados: dEstados, municipios: dMunicipios},
    ...METRICAS.valor,
    tooltip: ({dado}) => dado ? [`Lorem ipsum: ${num(dado.valor)}`, `Dolor sit amet: ${pct(dado.crescimento)}`, 'Consectetur adipiscing elit'] : ['Sed do eiusmod tempor'],
    aoSelecionar: (s) => { evento.textContent = s.tipo === 'brasil' ? 'Nenhuma seleção' : s.tipo === 'estado' ? `Estado: ${s.nome} (${s.uf})` : `Município: ${s.nome} · código IBGE ${s.codigo}`; },
  });
  document.getElementById('metrica').addEventListener('change', (e) => mapa.atualizar(null, METRICAS[e.target.value]));
  const temas = ['sistema', 'claro', 'escuro'], attr = {sistema: null, claro: 'light', escuro: 'dark'}; let i = 0;
  document.getElementById('tema').addEventListener('click', (e) => { i = (i + 1) % 3; const a = attr[temas[i]];
    if (a) document.documentElement.setAttribute('data-theme', a); else document.documentElement.removeAttribute('data-theme'); e.target.textContent = 'Tema: ' + temas[i]; });
  window.mapa = mapa; // para testar no console: mapa.focar('CE'), mapa.voltar(), mapa.isolar()
})().catch((e) => { document.getElementById('mapa').textContent = 'Não foi possível carregar os dados: ' + e.message + ' (abra com um servidor local — veja o README).'; });
