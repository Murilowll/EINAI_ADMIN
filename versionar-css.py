# -*- coding: utf-8 -*-
"""
Versiona o CSS pelo hash do conteúdo.

RODAR SEMPRE ANTES DE PUBLICAR, toda vez que assets/css/styles.css mudar:

    python versionar-css.py

Sem isso, o navegador continua servindo a folha antiga que já guardou —
o problema clássico de "alterei e não mudou nada no celular".
"""
import glob
import hashlib
import io
import re

CSS = 'assets/css/styles.css'

versao = hashlib.md5(io.open(CSS, 'rb').read()).hexdigest()[:8]
alterados = []

for arquivo in glob.glob('*.html') + glob.glob('links/*.html'):
    texto = io.open(arquivo, encoding='utf-8').read()
    novo = re.sub(r'styles\.css\?v=[A-Za-z0-9]+', 'styles.css?v=' + versao, texto)
    if novo != texto:
        io.open(arquivo, 'w', encoding='utf-8').write(novo)
        alterados.append(arquivo)

print('versao do CSS: ' + versao)
if alterados:
    print('paginas atualizadas: ' + ', '.join(alterados))
else:
    print('nenhuma pagina precisou mudar (ja estavam na versao atual)')
