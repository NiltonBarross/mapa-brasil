/*!
 * BrasilMapa — mapa coroplético do Brasil (estados → municípios) com zoom suave.
 * Depende apenas de d3 v7 (global `d3`). Sem build, sem framework.
 *
 * Uso mínimo:
 *   const mapa = BrasilMapa.criar(document.querySelector('#mapa'), {
 *     geo: { estados, municipios: (regiao) => fetch(`data/geo/municipios_${regiao}.json`).then(r => r.json()) },
 *     dados: { estados: { SP: { valor: 123 } }, municipios: { '355030': { valor: 45 } } },
 *   });
 */
(function (global) {
  'use strict';

  const REGIAO = {RO:'N',AC:'N',AM:'N',RR:'N',PA:'N',AP:'N',TO:'N',MA:'NE',PI:'NE',CE:'NE',RN:'NE',PB:'NE',PE:'NE',AL:'NE',SE:'NE',BA:'NE',MG:'SE',ES:'SE',RJ:'SE',SP:'SE',PR:'S',SC:'S',RS:'S',MS:'CO',MT:'CO',GO:'CO',DF:'CO'};
  const NOME = {AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
  // código IBGE de 6 dígitos das 27 capitais
  const CAPITAIS = new Set(['110020','120040','130260','140010','150140','160030','172100','211130','221100','230440','240810','250750','261160','270430','280030','292740','310620','320530','330455','355030','410690','420540','431490','500270','510340','520870','530010']);
  const PEQUENOS = ['SE','AL','PB','RN','DF','ES','RJ','SC']; // sem rótulo dentro do estado

  const PALETAS = {
    sequencial: ['#EEF2FB', '#C6D3F2', '#8FA8E4', '#4F73CF', '#1539AA', '#0B1F66'],
    quente: ['#FFF4DC', '#FFCC23', '#FF8800', '#FF4E05', '#FF222B', '#8E0B12'],
    divergente: ['#C8102E', '#F08A8A', '#F4F4F4', '#8FD1A6', '#0B8A3C'],
  };

  const nf = new Intl.NumberFormat('pt-BR');
  const nc = new Intl.NumberFormat('pt-BR', {notation: 'compact', maximumFractionDigits: 1});
  const FORMATOS = {
    numero: (v) => nf.format(v),
    compacto: (v) => nc.format(v),
    percentual: (v) => (v * 100).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%',
    variacao: (v) => (v > 0 ? '+' : '') + (v * 100).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%',
  };

  const PADRAO = {
    campo: 'valor',            // campo dos dados usado na cor
    escala: 'linear',          // 'linear' | 'log' | 'divergente' (centro em 0)
    paleta: 'sequencial',      // nome de PALETAS ou array de cores
    formato: 'compacto',       // nome de FORMATOS ou função (v) => texto
    titulo: 'Valor',           // nome da métrica na legenda e no tooltip
    altura: 600,
    nomesMunicipios: 18,       // quantos municípios ganham chamada (além das capitais)
    campoNomes: null,          // campo que define os "maiores" municípios com nome; padrão = campo
    tooltip: null,             // (ctx) => [linhas] ; ctx = {tipo, uf, codigo, nome, dado}
    aoSelecionar: null,        // ({tipo:'estado'|'municipio'|'brasil', uf, codigo, nome}) => void
    animacao: 800,             // ms; 0 desliga (respeita prefers-reduced-motion)
  };

  function criar(alvo, opcoes) {
    if (!global.d3) throw new Error('BrasilMapa: carregue o d3 v7 antes deste arquivo.');
    const o = Object.assign({}, PADRAO, opcoes);
    if (!o.geo || !o.geo.estados) throw new Error('BrasilMapa: informe geo.estados ({viewBox, estados}).');
    const el = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
    el.classList.add('bm');
    el.innerHTML = `
      <div class="bm-barra">
        <div class="bm-titulo"><button type="button" class="bm-voltar" hidden aria-label="Voltar ao Brasil">← Brasil</button><span class="bm-nome">Brasil</span></div>
        <div class="bm-acoes"><button type="button" class="bm-isolar" hidden aria-pressed="false">Isolar estado</button>
          <button type="button" class="bm-z" data-z="in" aria-label="Aproximar">+</button><button type="button" class="bm-z" data-z="out" aria-label="Afastar">−</button></div>
      </div>
      <div class="bm-area"><div class="bm-tip" role="tooltip"></div></div>
      <div class="bm-legenda"><span class="bm-min"></span><span class="bm-barra-cor"></span><span class="bm-max"></span><span class="bm-leg-txt"></span></div>`;
    const area = el.querySelector('.bm-area'), tip = el.querySelector('.bm-tip');
    const btVoltar = el.querySelector('.bm-voltar'), btIsolar = el.querySelector('.bm-isolar'), lbNome = el.querySelector('.bm-nome');

    const VB = o.geo.estados.viewBox, [vx, vy, vw, vh] = VB.split(' ').map(Number), PATHS = o.geo.estados.estados;
    const cache = {}; // malhas de municípios por região
    const carregarRegiao = (r) => cache[r] || (cache[r] = Promise.resolve(typeof o.geo.municipios === 'function' ? o.geo.municipios(r) : (o.geo.municipios || {})[r] || []));
    const st = {foco: null, isolar: false, mun: null, t: d3.zoomIdentity, zoomando: false, chamadas: [], feats: []};
    const reduz = () => !o.animacao || global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = (ms) => reduz() ? 0 : ms;
    const css = (v, fb) => getComputedStyle(el).getPropertyValue(v).trim() || fb;

    const svg = d3.select(area).append('svg').attr('viewBox', VB).attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img').attr('aria-label', 'Mapa do Brasil por estado').style('height', o.altura + 'px');
    const raiz = svg.append('g'), gU = raiz.append('g'), gM = raiz.append('g'), gO = raiz.append('g').attr('pointer-events', 'none'), gL = raiz.append('g').attr('pointer-events', 'none');
    const gC = svg.append('g').attr('pointer-events', 'none');

    // ---------- cores ----------
    let cor, fmt, faixa;
    function montarEscala(valores) {
      const pal = Array.isArray(o.paleta) ? o.paleta : PALETAS[o.paleta] || PALETAS.sequencial;
      const vs = valores.filter((v) => v != null && isFinite(v)); const ex = vs.length ? d3.extent(vs) : [0, 1];
      const interp = d3.interpolateRgbBasis(pal);
      fmt = typeof o.formato === 'function' ? o.formato : FORMATOS[o.formato] || FORMATOS.compacto;
      if (o.escala === 'divergente') { const m = d3.quantile(vs.map(Math.abs).sort(d3.ascending), 0.95) || d3.max(vs, Math.abs) || 1; const s = d3.scaleLinear().domain([-m, m]).clamp(true); cor = (v) => interp(s(v)); faixa = [-m, m]; }
      else if (o.escala === 'log') { const s = d3.scaleLog().domain([Math.max(1, ex[0]), Math.max(2, ex[1])]).clamp(true); cor = (v) => interp(s(Math.max(1, v))); faixa = ex; }
      else { const s = d3.scaleLinear().domain(ex).clamp(true); cor = (v) => interp(Math.pow(s(v), 1.4)); faixa = ex; }
      el.querySelector('.bm-barra-cor').style.background = `linear-gradient(90deg, ${d3.range(9).map((i) => interp(i / 8)).join(',')})`;
      el.querySelector('.bm-min').textContent = fmt(faixa[0]); el.querySelector('.bm-max').textContent = fmt(faixa[1]);
    }
    const val = (d) => d ? d[o.campo] : null;
    const corDe = (d) => val(d) == null ? css('--bm-sem-dado', '#D5DAE3') : cor(val(d));

    // ---------- tooltip ----------
    function linhasPadrao(ctx) { return ctx.dado ? [`${o.titulo}: ${fmt(val(ctx.dado))}`] : ['Sem dados']; }
    function mostrarTip(e, titulo, linhas) {
      const b = area.getBoundingClientRect();
      tip.replaceChildren(Object.assign(document.createElement('strong'), {textContent: titulo}), ...linhas.map((l) => Object.assign(document.createElement('div'), {textContent: l})));
      tip.style.display = 'block';
      const x = e.clientX - b.left + 14, y = e.clientY - b.top + 14;
      tip.style.left = Math.min(x, b.width - tip.offsetWidth - 6) + 'px'; tip.style.top = Math.min(y, b.height - tip.offsetHeight - 6) + 'px';
    }
    const esconderTip = () => { tip.style.display = 'none'; };
    const tipDe = (ctx) => (o.tooltip || linhasPadrao)(ctx);

    // ---------- zoom ----------
    const zoom = d3.zoom().scaleExtent([1, 40]).translateExtent([[vx - vw * 0.2, vy - vh * 0.2], [vx + vw * 1.2, vy + vh * 1.2]])
      .on('start', () => { st.zoomando = true; gC.attr('opacity', 0); })
      .on('zoom', (e) => { raiz.attr('transform', e.transform); st.t = e.transform; gL.attr('opacity', st.foco || e.transform.k > 1.15 ? 0 : 1); })
      .on('end', (e) => { st.zoomando = false; st.t = e.transform;
        if (e.sourceEvent && e.transform.k < 1.3 && st.foco) voltar(); else desenharChamadas(); });
    svg.call(zoom).on('dblclick.zoom', null);
    const irPara = (t, fim) => { svg.interrupt(); const tr = svg.transition().duration(dur(o.animacao)).ease(d3.easeCubicInOut).call(zoom.transform, t); if (fim) { if (dur(1)) tr.on('end', fim); else fim(); } };
    const caixaUF = (u) => gU.selectAll('path').filter((x) => x === u).node().getBBox();
    const transfUF = (u) => { const b = caixaUF(u), k = Math.min(40, (st.isolar ? 0.9 : 0.86) / Math.max(b.width / vw, b.height / vh));
      return d3.zoomIdentity.translate(vx + vw / 2, vy + vh / 2).scale(k).translate(-(b.x + b.width / 2), -(b.y + b.height / 2)); };
    el.querySelectorAll('.bm-z').forEach((b) => b.addEventListener('click', () => svg.transition().duration(dur(300)).call(zoom.scaleBy, b.dataset.z === 'in' ? 1.6 : 1 / 1.6)));

    // ---------- estados ----------
    let dados = {estados: {}, municipios: {}};
    function desenharEstados() {
      const E = dados.estados || {}, ufs = Object.keys(PATHS);
      montarEscala(ufs.map((u) => val(E[u])));
      const borda = css('--bm-borda', '#fff'), fg = css('--bm-texto', '#1B1F2E');
      gU.selectAll('path').data(ufs, (u) => u).join('path').attr('d', (u) => PATHS[u])
        .attr('stroke', borda).attr('stroke-width', 1).attr('vector-effect', 'non-scaling-stroke').attr('stroke-linejoin', 'round').style('cursor', 'pointer')
        .attr('tabindex', 0).attr('aria-label', (u) => `${NOME[u]}: ${val(E[u]) == null ? 'sem dados' : fmt(val(E[u]))}`)
        .each(function (u) { this.dataset.c = corDe(E[u]); })
        .on('click', (e, u) => { esconderTip(); focar(u); })
        .on('keydown', (e, u) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focar(u); } })
        .on('mousemove', function (e, u) { if (st.foco === u) return; d3.select(this).attr('stroke', fg).attr('stroke-width', 1.6).raise();
          mostrarTip(e, NOME[u], [...tipDe({tipo: 'estado', uf: u, nome: NOME[u], dado: E[u]}), 'Clique para ver os municípios']); })
        .on('mouseleave', function () { d3.select(this).attr('stroke', borda).attr('stroke-width', 1); esconderTip(); });
      aplicarFoco(true);
      gL.selectAll('*').remove();
      ufs.forEach((u) => { const b = caixaUF(u); if (b.width < 30 || PEQUENOS.includes(u)) return;
        const c = d3.color(corDe(E[u])), escuro = c && (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) < 140, tc = escuro ? '#fff' : '#1a1a1a';
        const g = gL.append('g').attr('transform', `translate(${b.x + b.width / 2},${b.y + b.height / 2})`);
        g.append('text').attr('text-anchor', 'middle').attr('font-size', 15).attr('font-weight', 700).attr('fill', tc).text(u);
        if (b.width >= 60 && val(E[u]) != null) g.append('text').attr('text-anchor', 'middle').attr('y', 15).attr('font-size', 13).attr('fill', tc).text(fmt(val(E[u]))); });
      legenda();
    }
    function aplicarFoco(instantaneo) {
      const f = st.foco, mudo = css('--bm-esmaecido', '#C3C9D6');
      gU.selectAll('path').attr('pointer-events', st.isolar ? 'none' : null).transition().duration(instantaneo ? 0 : dur(450))
        .attr('fill', function (u) { return !f || u === f ? this.dataset.c : mudo; })
        .attr('fill-opacity', (u) => !f || u === f ? 1 : st.isolar ? 0 : 0.28).attr('stroke-opacity', (u) => st.isolar && u !== f ? 0 : 1);
    }

    // ---------- municípios ----------
    async function desenharMunicipios(u) {
      const feats = (await carregarRegiao(REGIAO[u])).filter((f) => f.uf === u && f.d);
      if (st.foco !== u) return; // usuário já saiu
      const M = dados.municipios || {}, borda = css('--bm-borda', '#fff'), fg = css('--bm-texto', '#1B1F2E'), sel = css('--bm-selecao', '#FF4E05');
      montarEscala(feats.map((f) => val(M[f.cd_municipio])));
      gM.interrupt().attr('opacity', 1).selectAll('path').remove();
      gM.selectAll('path').data(feats, (f) => f.cd_municipio).join('path').attr('d', (f) => f.d)
        .attr('fill', (f) => corDe(M[f.cd_municipio])).attr('stroke', borda).attr('stroke-width', 0.5).attr('vector-effect', 'non-scaling-stroke').style('cursor', 'pointer')
        .on('click', (e, f) => { e.stopPropagation(); selecionarMunicipio(f.cd_municipio === st.mun ? null : f.cd_municipio); })
        .on('mousemove', function (e, f) { d3.select(this).attr('stroke', fg).attr('stroke-width', 1.4).raise();
          mostrarTip(e, f.nome + (CAPITAIS.has(f.cd_municipio) ? ' (capital)' : ''), tipDe({tipo: 'municipio', uf: u, codigo: f.cd_municipio, nome: f.nome, dado: M[f.cd_municipio]})); })
        .on('mouseleave', function (e, f) { const s = f.cd_municipio === st.mun; d3.select(this).attr('stroke', s ? sel : borda).attr('stroke-width', s ? 2.4 : 0.5); esconderTip(); })
        .attr('opacity', 0).transition().duration(dur(380)).attr('opacity', 1);
      gO.selectAll('*').remove();
      gO.append('path').attr('d', PATHS[u]).attr('fill', 'none').attr('stroke', css('--bm-contorno', '#1539AA')).attr('stroke-width', 2.2).attr('vector-effect', 'non-scaling-stroke');
      st.feats = gM.selectAll('path').data();
      gM.selectAll('path').each(function (f) { if (!f._c) { const b = this.getBBox(); f._c = [b.x + b.width / 2, b.y + b.height / 2]; f._s = Math.max(b.width, b.height); } });
      prepararChamadas(); legenda();
    }
    function prepararChamadas() {
      const M = dados.municipios || {};
      const cn = o.campoNomes || o.campo, vn = (d) => d ? d[cn] : null;
      const top = new Set(st.feats.filter((f) => vn(M[f.cd_municipio]) != null).sort((a, b) => vn(M[b.cd_municipio]) - vn(M[a.cd_municipio])).slice(0, o.nomesMunicipios).map((f) => f.cd_municipio));
      if (st.mun) top.add(st.mun);
      st.chamadas = st.feats.filter((f) => top.has(f.cd_municipio) || CAPITAIS.has(f.cd_municipio)).map((f) => ({f, cap: CAPITAIS.has(f.cd_municipio), sel: f.cd_municipio === st.mun}));
      const sel = css('--bm-selecao', '#FF4E05'), borda = css('--bm-borda', '#fff');
      gM.selectAll('path').attr('stroke', (f) => f.cd_municipio === st.mun ? sel : borda).attr('stroke-width', (f) => f.cd_municipio === st.mun ? 2.4 : 0.5)
        .filter((f) => f.cd_municipio === st.mun).raise();
      desenharChamadas();
    }
    // nomes com linha-guia nas laterais do estado; mais perto, nomes dentro dos municípios que couberem
    function desenharChamadas() {
      gC.selectAll('*').remove(); gC.attr('opacity', 1);
      if (!st.foco || st.zoomando || !st.chamadas.length) return;
      const T = st.t, ub = caixaUF(st.foco), fg = css('--bm-texto', '#1B1F2E'), fundo = css('--bm-fundo', '#fff'), cap = css('--bm-capital', '#1539AA'), sel = css('--bm-selecao', '#FF4E05');
      const sx0 = T.applyX(ub.x), sx1 = T.applyX(ub.x + ub.width), meio = (sx0 + sx1) / 2, passo = 19;
      const L = Math.max(vx + 6, sx0 - 14), R = Math.min(vx + vw - 6, sx1 + 14);
      const itens = st.chamadas.map((c) => ({...c, x: T.applyX(c.f._c[0]), y: T.applyY(c.f._c[1])})).filter((c) => c.x >= vx && c.x <= vx + vw && c.y >= vy && c.y <= vy + vh);
      const lados = {l: itens.filter((c) => c.x < meio).sort((a, b) => a.y - b.y), r: itens.filter((c) => c.x >= meio).sort((a, b) => a.y - b.y)};
      const posicionar = (arr) => { arr.forEach((c, i) => { c.ly = Math.max(c.y, i ? arr[i - 1].ly + passo : vy + 12); });
        const exc = arr.length ? arr[arr.length - 1].ly - (vy + vh - 8) : 0; if (exc > 0) arr.forEach((c) => { c.ly -= exc; });
        for (let i = 1; i < arr.length; i++) if (arr[i].ly < arr[i - 1].ly + passo) arr[i].ly = arr[i - 1].ly + passo; };
      posicionar(lados.l); posicionar(lados.r);
      const desenhar = (arr, lado) => arr.forEach((c) => { const lx = lado === 'l' ? L : R, ex = lado === 'l' ? lx + 4 : lx - 4, col = c.sel ? sel : c.cap ? cap : fg;
        gC.append('path').attr('d', `M${c.x},${c.y}L${ex + (lado === 'l' ? 10 : -10)},${c.ly}L${ex},${c.ly}`).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 0.9).attr('stroke-opacity', 0.75);
        gC.append('circle').attr('cx', c.x).attr('cy', c.y).attr('r', c.cap ? 3.6 : 2.4).attr('fill', c.cap ? '#fff' : col).attr('stroke', col).attr('stroke-width', 1.2);
        gC.append('text').attr('x', lx).attr('y', c.ly + 4.5).attr('text-anchor', lado === 'l' ? 'end' : 'start').attr('font-size', c.cap || c.sel ? 15 : 14).attr('font-weight', c.cap || c.sel ? 800 : 600)
          .attr('fill', col).attr('stroke', fundo).attr('stroke-width', 4).attr('paint-order', 'stroke').text((c.cap ? '★ ' : '') + c.f.nome); });
      desenhar(lados.l, 'l'); desenhar(lados.r, 'r');
      const usados = new Set(itens.map((c) => c.f.cd_municipio)), caixas = []; gC.selectAll('text').each(function () { caixas.push(this.getBBox()); });
      st.feats.filter((f) => !usados.has(f.cd_municipio) && f._s * T.k > 55).sort((a, b) => b._s - a._s).forEach((f) => {
        const x = T.applyX(f._c[0]), y = T.applyY(f._c[1]); if (x < vx || x > vx + vw || y < vy || y > vy + vh) return;
        const t = gC.append('text').attr('x', x).attr('y', y + 4).attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 600).attr('fill', '#1a1a1a')
          .attr('stroke', 'rgba(255,255,255,.8)').attr('stroke-width', 3).attr('paint-order', 'stroke').text(f.nome);
        const b = t.node().getBBox(); if (caixas.some((q) => b.x < q.x + q.width + 2 && q.x < b.x + b.width + 2 && b.y < q.y + q.height && q.y < b.y + b.height)) t.remove(); else caixas.push(b); });
    }

    // ---------- navegação ----------
    function focar(u) {
      if (!PATHS[u]) return;
      st.foco = u; st.mun = null; st.chamadas = []; gC.selectAll('*').remove(); gO.selectAll('*').remove();
      gM.transition().duration(dur(120)).attr('opacity', 0).on('end', () => gM.selectAll('path').remove());
      aplicarFoco(); gL.transition().duration(dur(200)).attr('opacity', 0);
      atualizarBarra();
      irPara(transfUF(u), () => desenharMunicipios(u));
      o.aoSelecionar && o.aoSelecionar({tipo: 'estado', uf: u, nome: NOME[u]});
    }
    function voltar() {
      st.foco = null; st.mun = null; st.isolar = false; st.chamadas = []; st.feats = [];
      gC.selectAll('*').remove(); gO.selectAll('*').remove();
      gM.transition().duration(dur(150)).attr('opacity', 0).on('end', () => gM.selectAll('path').remove());
      montarEscala(Object.keys(PATHS).map((u) => val((dados.estados || {})[u]))); aplicarFoco(); atualizarBarra(); legenda();
      irPara(d3.zoomIdentity, () => gL.transition().duration(dur(250)).attr('opacity', 1));
      o.aoSelecionar && o.aoSelecionar({tipo: 'brasil'});
    }
    function selecionarMunicipio(cod) {
      st.mun = cod; prepararChamadas();
      const f = cod && st.feats.find((x) => x.cd_municipio === cod);
      o.aoSelecionar && o.aoSelecionar(f ? {tipo: 'municipio', uf: st.foco, codigo: cod, nome: f.nome} : {tipo: 'estado', uf: st.foco, nome: NOME[st.foco]});
    }
    function isolar(sim) { if (!st.foco) return; st.isolar = sim == null ? !st.isolar : !!sim; el.classList.toggle('bm-iso', st.isolar); aplicarFoco(); atualizarBarra(); irPara(transfUF(st.foco), desenharChamadas); }
    function atualizarBarra() {
      btVoltar.hidden = !st.foco; btIsolar.hidden = !st.foco; btIsolar.setAttribute('aria-pressed', st.isolar); btIsolar.textContent = st.isolar ? 'Mostrar Brasil' : 'Isolar estado';
      lbNome.textContent = st.foco ? NOME[st.foco] : 'Brasil'; el.classList.toggle('bm-iso', st.isolar);
    }
    function legenda() { el.querySelector('.bm-leg-txt').textContent = st.foco ? `${o.titulo} por município · ★ capital · cinza: sem dados · role para afastar` : `${o.titulo} por estado · clique num estado para aproximar`; }
    btVoltar.addEventListener('click', voltar);
    btIsolar.addEventListener('click', () => isolar());
    const esc = (e) => { if (e.key === 'Escape' && st.foco && el.isConnected) voltar(); };
    document.addEventListener('keydown', esc);

    // ---------- API ----------
    function atualizar(novos, novasOpcoes) {
      if (novos) dados = Object.assign({estados: {}, municipios: {}}, novos);
      if (novasOpcoes) Object.assign(o, novasOpcoes);
      desenharEstados();
      if (st.foco) desenharMunicipios(st.foco);
    }
    atualizar(o.dados || {});
    const tema = new MutationObserver(() => atualizar()); tema.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme', 'class']});
    return {
      atualizar, focar, voltar, isolar,
      selecionarMunicipio: (cod) => st.foco && selecionarMunicipio(cod),
      estado: () => ({uf: st.foco, municipio: st.mun, isolado: st.isolar, zoom: st.t.k}),
      destruir: () => { tema.disconnect(); document.removeEventListener('keydown', esc); svg.on('.zoom', null); el.replaceChildren(); el.classList.remove('bm', 'bm-iso'); },
    };
  }

  global.BrasilMapa = {criar, NOME, REGIAO, CAPITAIS, PALETAS, FORMATOS, versao: '1.0.0'};
})(typeof window !== 'undefined' ? window : this);
