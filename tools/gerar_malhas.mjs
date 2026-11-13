// Gera data/geo/*.json a partir do GeoJSON do IBGE (propriedades: uf; municípios: id com código IBGE, nome, uf).
// Uso: npm i d3-geo && node tools/gerar_malhas.mjs   (com fonte/estados.geojson e fonte/municipios.geojson)
import fs from 'fs';
import {geoMercator, geoPath, geoArea} from 'd3-geo';
const uf = JSON.parse(fs.readFileSync('fonte/estados.geojson')), mun = JSON.parse(fs.readFileSync('fonte/municipios.geojson'));
const area = (r) => { let a = 0; for (let i = 0, n = r.length; i < n; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % n]; a += x1 * y2 - x2 * y1; } return a / 2; };
const fix = (poly) => poly.map((r, i) => { const cw = area(r) < 0; return (i === 0 ? cw : !cw) ? r : r.slice().reverse(); });
const rewind = (fc) => { fc.features.forEach((f) => { const g = f.geometry; if (!g) return; if (g.type === 'Polygon') g.coordinates = fix(g.coordinates); else if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(fix); }); return fc; };
rewind(uf); rewind(mun);
const flip = (g) => { const rv = (poly) => poly.map((r) => r.slice().reverse()); if (g.type === 'Polygon') g.coordinates = rv(g.coordinates); else g.coordinates = g.coordinates.map(rv); };
let flipped = 0; for (const fc of [uf, mun]) fc.features.forEach((f) => { if (f.geometry && geoArea(f) > 2 * Math.PI) { flip(f.geometry); flipped++; } });
const bad = [uf, mun].flatMap((fc) => fc.features.filter((f) => f.geometry && geoArea(f) > 2 * Math.PI).map((f) => f.properties.uf + ' ' + (f.properties.nome || '')));
console.log('flipped', flipped, 'still bad', bad);
const W = 1000, proj = geoMercator().fitWidth(W, uf), path = geoPath(proj);
const [[x0, y0], [x1, y1]] = path.bounds(uf);
const r = (s) => (s || '').replace(/(\.\d\d)\d+/g, '$1');
const ufp = {}; uf.features.forEach((f) => { ufp[f.properties.uf] = r(path(f)); });
fs.writeFileSync('data/geo/estados.json', JSON.stringify({viewBox: `${Math.floor(x0)} ${Math.floor(y0)} ${Math.ceil(x1 - x0)} ${Math.ceil(y1 - y0)}`, estados: ufp}));
const REG = {RO:'N',AC:'N',AM:'N',RR:'N',PA:'N',AP:'N',TO:'N',MA:'NE',PI:'NE',CE:'NE',RN:'NE',PB:'NE',PE:'NE',AL:'NE',SE:'NE',BA:'NE',MG:'SE',ES:'SE',RJ:'SE',SP:'SE',PR:'S',SC:'S',RS:'S',MS:'CO',MT:'CO',GO:'CO',DF:'CO'};
const out = {};
mun.features.forEach((f) => { (out[REG[f.properties.uf]] ??= []).push({uf: f.properties.uf, cd_municipio: f.properties.id.slice(0, 6), nome: f.properties.nome, d: r(path(f))}); });
for (const [k, v] of Object.entries(out)) fs.writeFileSync(`data/geo/municipios_${k}.json`, JSON.stringify(v));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])), x0, y0, x1, y1);
