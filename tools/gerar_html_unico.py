"""Gera dist/mapa-brasil.html: um único arquivo com CSS, JS, d3 e todos os dados embutidos.
Uso (na raiz do projeto):  python tools/gerar_html_unico.py
"""
import json, pathlib, re
R = pathlib.Path(__file__).resolve().parent.parent
ler = lambda p: (R / p).read_text(encoding='utf-8')
arquivos = {str(p.relative_to(R)).replace('\\', '/'): json.loads(p.read_text(encoding='utf-8'))
            for p in sorted((R / 'data').rglob('*.json'))}
shim = ("const __EMBUTIDO=" + json.dumps(arquivos, ensure_ascii=False, separators=(',', ':')) + ";"
        "const __fetch=window.fetch.bind(window);window.fetch=(u,...a)=>{const k=String(u).replace(/^\\.?\\//,'');"
        "return k in __EMBUTIDO?Promise.resolve(new Response(JSON.stringify(__EMBUTIDO[k]),{headers:{'Content-Type':'application/json'}})):__fetch(u,...a);};")
html = ler('index.html')
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>\n' + ler(m.group(1)) + '\n</style>', html)
html = re.sub(r'<script src="([^"]+)"></script>', lambda m: '<script>\n' + ler(m.group(1)).replace('</script', '<\\/script') + '\n</script>', html)
html = html.replace('<script>', '<script>\n' + shim + '\n</script>\n<script>', 1)
(R / 'dist').mkdir(exist_ok=True)
saida = R / 'dist' / 'mapa-brasil.html'
saida.write_text(html, encoding='utf-8')
print(saida, round(saida.stat().st_size / 1e6, 2), 'MB')
