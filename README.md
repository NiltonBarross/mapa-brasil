# 🗺️ Mapa do Brasil: estados e municípios

Componente de mapa **coroplético do Brasil** em JavaScript puro + [d3 v7](https://d3js.org).
Ele mostra os 27 estados coloridos por qualquer indicador e, ao clicar, **voa suavemente até o estado** e abre os **5.570 municípios**, com os nomes das maiores cidades e das capitais.

Componente genérico, pronto para ser reaproveitado em qualquer projeto.

![versão](https://img.shields.io/badge/versão-1.0.0-1539AA) ![dependências](https://img.shields.io/badge/dependências-só%20d3%20v7-FF4E05) ![build](https://img.shields.io/badge/build-não%20precisa-0B8A3C)

---

## ✨ Funcionalidades

| | Funcionalidade | Como funciona |
|---|---|---|
| 🎨 | **Mapa de calor por estado** | Cada UF é pintada pela métrica escolhida, com sigla e valor dentro do estado. |
| 🔍 | **Zoom suave até o estado** | Clicar num estado faz uma transição animada; os municípios aparecem em *fade* ao chegar. |
| 🏙️ | **Municípios** | Todos os municípios do estado, coloridos na mesma lógica; cinza = sem dados. |
| 🏷️ | **Nomes com linha-guia** | As maiores cidades (18 por padrão) e a capital (★) ganham rótulo nas laterais, sem sobreposição. |
| 🔎 | **Mais zoom, mais nomes** | Ao aproximar com a roda do mouse ou o gesto de pinça, os nomes passam a aparecer dentro dos municípios que couberem. |
| 🎯 | **Isolar estado** | Esconde o resto do Brasil e amplia o estado escolhido. |
| ↩️ | **Voltar ao Brasil** | Botão "← Brasil", tecla **Esc** ou afastar o zoom. |
| 💬 | **Tooltip** | Ao passar o mouse; o conteúdo é configurável. |
| 📍 | **Seleção de município** | Clique destaca o município e dispara o evento `aoSelecionar`. |
| 🌗 | **Tema claro e escuro** | Segue o sistema ou o atributo `data-theme="light|dark"` no `<html>`. |
| 🎛️ | **Escalas** | `linear`, `log` (para volumes muito desiguais) e `divergente` (centro em zero, para variações). |
| ♿ | **Acessibilidade** | Estados navegáveis por teclado (Tab + Enter), `aria-label` com o valor e respeito a "reduzir movimento". |
| 📱 | **Responsivo** | Funciona no celular, com gesto de pinça para o zoom. |

---

## 📦 O que vem no pacote

```
mapa-brasil/
├── dist/
│   └── mapa-brasil.html        ← ARQUIVO ÚNICO: abre com duplo clique, funciona sem internet
├── index.html                  ← página de exemplo (versão separada)
├── src/
│   ├── brasil-mapa.js          ← o componente (único arquivo que você precisa copiar)
│   ├── brasil-mapa.css         ← estilos do componente (cores nas variáveis --bm-*)
│   ├── demo.js                 ← exemplo de uso
│   └── demo.css                ← estilos só da página de exemplo
├── data/
│   ├── geo/
│   │   ├── estados.json        ← contorno dos 27 estados (já projetado)
│   │   └── municipios_{N,NE,SE,S,CO}.json  ← municípios por região (carregados sob demanda)
│   └── exemplo/
│       ├── estados.json        ← dados fictícios por UF
│       └── municipios.json     ← dados fictícios por código IBGE
├── vendor/
│   └── d3.v7.min.js            ← d3 v7.9.0 (local, sem CDN)
├── tools/
│   ├── gerar_html_unico.py     ← gera o dist/mapa-brasil.html
│   └── gerar_malhas.mjs        ← regenera as malhas a partir do GeoJSON do IBGE
├── package.json
└── README.md
```

---

## 🚀 Como usar

### Opção 1 · Só olhar ou compartilhar
Abra **`dist/mapa-brasil.html`**. Ele tem tudo embutido: código, d3, malhas e dados.

### Opção 2 · Rodar a versão separada
A página carrega os JSON com `fetch`, então precisa de um servidor local (abrir o `index.html` direto pelo explorador de arquivos não funciona):

```bash
npm run dev               # ou: npx serve .
# ou, com Python:
python -m http.server 5173
```
Depois acesse `http://localhost:5173`.

### Opção 3 · Colocar em outro projeto

1. Copie `src/brasil-mapa.js`, `src/brasil-mapa.css`, `vendor/d3.v7.min.js` e a pasta `data/geo/`.
2. Na sua página:

```html
<link rel="stylesheet" href="brasil-mapa.css">
<div id="mapa"></div>

<script src="d3.v7.min.js"></script>
<script src="brasil-mapa.js"></script>
<script>
  const json = (u) => fetch(u).then((r) => r.json());

  json('data/geo/estados.json').then((estados) => {
    const mapa = BrasilMapa.criar('#mapa', {
      geo: {
        estados,
        municipios: (regiao) => json(`data/geo/municipios_${regiao}.json`), // N, NE, SE, S ou CO
      },
      dados: {
        estados:    { SP: { valor: 83 }, CE: { valor: 59 } },     // chave = sigla da UF
        municipios: { '355030': { valor: 412 } },                         // chave = código IBGE (6 dígitos)
      },
      titulo: 'Lorem ipsum',
      escala: 'linear',
      formato: 'compacto',
      aoSelecionar: (s) => console.log(s),
    });
  });
</script>
```

---

## ⚙️ Opções

| Opção | Padrão | Descrição |
|---|---|---|
| `geo.estados` | — | **Obrigatório.** Conteúdo de `data/geo/estados.json`. |
| `geo.municipios` | — | Função `(regiao) => Promise<lista>` ou objeto `{N: [...], NE: [...]}`. |
| `dados.estados` | `{}` | `{ UF: { campo: valor, ... } }` |
| `dados.municipios` | `{}` | `{ codigoIBGE6: { campo: valor, ... } }` |
| `campo` | `'valor'` | Campo usado para a cor. |
| `titulo` | `'Valor'` | Nome da métrica na legenda e no tooltip. |
| `escala` | `'linear'` | `'linear'`, `'log'` ou `'divergente'`. |
| `paleta` | `'sequencial'` | `'sequencial'`, `'quente'`, `'divergente'` ou um array de cores. |
| `formato` | `'compacto'` | `'numero'`, `'compacto'`, `'percentual'`, `'variacao'` ou `(v) => texto`. |
| `altura` | `600` | Altura do mapa em px (no celular passa para 380 px). |
| `nomesMunicipios` | `18` | Quantos municípios recebem nome com linha-guia (as capitais sempre recebem). |
| `campoNomes` | = `campo` | Campo que define quais são os "maiores" municípios. Útil quando a cor é crescimento, mas os nomes devem ser das maiores cidades. |
| `tooltip` | — | `({tipo, uf, codigo, nome, dado}) => ['linha 1', 'linha 2']` |
| `aoSelecionar` | — | `({tipo: 'brasil' \| 'estado' \| 'municipio', uf, codigo, nome}) => {}` |
| `animacao` | `800` | Duração do voo em ms; `0` desliga. |

## 🧩 Métodos

```js
mapa.focar('CE');                     // voa até o Ceará
mapa.selecionarMunicipio('230440');   // destaca Fortaleza (com um estado em foco)
mapa.isolar();                        // liga/desliga "Isolar estado"
mapa.voltar();                        // volta ao Brasil
mapa.atualizar(novosDados);           // troca os dados
mapa.atualizar(null, { campo: 'crescimento', escala: 'divergente', paleta: 'divergente', formato: 'variacao' }); // troca a métrica
mapa.estado();                        // { uf, municipio, isolado, zoom }
mapa.destruir();                      // remove o mapa e os eventos
```

Utilitários: `BrasilMapa.NOME` (nome das UFs), `BrasilMapa.REGIAO`, `BrasilMapa.CAPITAIS`, `BrasilMapa.PALETAS` e `BrasilMapa.FORMATOS`.

## 🎨 Personalizar cores

Sobrescreva as variáveis no seu CSS:

```css
#mapa {
  --bm-destaque: #1539AA;   /* título e botão ativo */
  --bm-contorno: #1539AA;   /* contorno do estado em foco */
  --bm-selecao:  #FF4E05;   /* município selecionado */
  --bm-capital:  #1539AA;   /* nome da capital */
  --bm-sem-dado: #D5DAE3;   /* municípios sem dados */
  --bm-raio: 14px;
}
```

## 🗂️ Formato das malhas

- `estados.json`: `{ "viewBox": "x y largura altura", "estados": { "SP": "M...Z", ... } }`
- `municipios_XX.json`: `[ { "uf": "CE", "cd_municipio": "230440", "nome": "Fortaleza", "d": "M...Z" }, ... ]`

Os contornos já vêm **projetados** (Mercator, 1.000 px de largura), por isso o navegador não precisa calcular a projeção. Estados e municípios usam a mesma projeção, então encaixam perfeitamente. Para regenerar a partir do GeoJSON do IBGE, use `tools/gerar_malhas.mjs` (requer `d3-geo`).

> **Código do município:** usa o código IBGE de **6 dígitos**, o mesmo padrão da ANS e do DATASUS. Se a sua base tem 7 dígitos, use `codigo.slice(0, 6)`.

## 🔁 Gerar o HTML único

Depois de alterar código ou dados:

```bash
python tools/gerar_html_unico.py   # cria dist/mapa-brasil.html (~1,8 MB)
```

## 📄 Fontes

- Malhas municipais e estaduais: **IBGE**.
- Dados de exemplo: **fictícios**, gerados aleatoriamente (textos em *lorem ipsum*).
- Visualização: **d3 v7** (licença ISC).
