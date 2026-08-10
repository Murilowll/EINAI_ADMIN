# Instituto EINAI — Fluxos e Design System

Documentação do site institucional e das páginas de curso.
Última atualização: 9 de agosto de 2026.

---

## 1. Mapa do projeto

| arquivo | o que é |
|---|---|
| `index.html` | Home institucional |
| `ser.html` | Página do SER — Evolução e Liderança (com checkout) |
| `introducao-pnl.html` | Página da Introdução à PNL (com checkout) |
| `practitioner.html` | Página do Practitioner (com checkout) |
| `termos-de-uso.html` | Termos de Uso |
| `politica-de-privacidade.html` | Política de Privacidade (LGPD) |
| `admin.html` + `script.js` | Painel administrativo (CRM, turmas, financeiro) |
| `form-einai.html` | Formulário avulso |

**CSS**

| arquivo | escopo |
|---|---|
| `assets/css/styles.css` | Home, páginas legais, componentes do site institucional |
| `assets/css/Features-Image-icons.css` | **Compartilhado** pelas três páginas de curso |
| `assets/css/forms-einai.css` | Formulários |

> ⚠️ `Features-Image-icons.css` é usado por SER, PNL e Practitioner ao mesmo tempo.
> Alterar cor ali repinta as três. Para mudar só uma página, sobrescrever no
> `<style>` da própria página, que carrega depois e vence por ordem.

---

## 2. Home — ordem das seções

```
Navbar (fixa, auto-hide no scroll)
 └ Hero
 └ Diferenciais        #diferenciais
 └ Treinamentos        #treinamentos
 └ Depoimentos         #depoimentos
 └ Quem Somos          #sobre
 └ FAQ                 #faq
 └ CTA final
 └ Rodapé
```

### Padrão de cabeçalho de seção

**Toda seção tem apenas um `<h2>`.** Sem olho (eyebrow), sem subtítulo.
O bloco do título usa `.text-center.mb-5` (48px até o conteúdo).

### Hero

- Título animado **palavra por palavra**, com máscara — mesma técnica do site da Line.
  Cada palavra vira `.hero-word` (`overflow: hidden`) com `.hero-word-inner` saindo de
  `translateY(140%)`. Duração 1,6s, stagger 0,08s, ease `cubic-bezier(.16,1,.3,1)`.
  O split é feito por JS no `DOMContentLoaded`; sem JS o h1 cai numa animação de bloco.
- `aria-label` no h1 com o texto inteiro, palavras com `aria-hidden`.
- Não respeita `prefers-reduced-motion` (decisão deliberada — o Windows do cliente
  reporta `reduce` e isso desligava a animação).

### Treinamentos — 7 cards

Ordem: SER · SER II Alto Impacto · Introdução à PNL · Practitioner · Coaching · SER Jovem · Harmonização

| card | destino |
|---|---|
| SER | `ser.html` |
| Introdução à PNL | `introducao-pnl.html` |
| Practitioner | `practitioner.html` |
| SER II, Coaching, SER Jovem, Harmonização | modal "Em Breve" |

**Anatomia:** o card inteiro é um `<a>` (não um `<div>` com overlay — overlay perde o
hit-test dentro do painel). O "Saiba mais" é um `<span>`, não um link aninhado.

- Proporção **768 × 1365** (9:16)
- Altura governada pela janela: `clamp(340px, 62vh, 560px)`; a largura vem da proporção
- Container `.training-grid` com `max-width` calculado para travar **4 por fileira**
  (`--training-w * 4 + gap * 3 + 4px`) — os 4px de folga evitam que o arredondamento
  sub-pixel quebre a linha
- `#treinamentos` tem `max-width` próprio, maior que o `.container` do Bootstrap (1320px),
  porque 4 cards no tamanho cheio precisam de 1344px

**Hover:** a foto dá zoom 1.05, a logo cai para 28% de opacidade e o painel escuro surge
**apenas por opacidade** (o fundo não se move; quem desliza 12px é o texto). O gradiente
termina 100% transparente no topo — se tiver parada opaca no topo, aparece um retângulo
subindo. Em `(hover: none)` o painel já vem aberto.

### Depoimentos — 5 vídeos do Vimeo

| pessoa | ID |
|---|---|
| Kelly | 1216829831 |
| Alice | 1216829832 |
| Athos | 1216829833 |
| Charles | 1216843748 |
| Institucional | 1216843682 |

Dois por fileira. **Sem legenda** — os nomes já estão queimados nos vídeos.

**Carregamento sob demanda:** entra só a capa (`assets/img/depoimentos/*.jpg`, ~30 KB)
dentro de um `<button>`; o `<iframe>` do Vimeo é criado no clique, já com autoplay.
Cinco iframes na abertura custariam megabytes sem ninguém dar play.

### Rodapé

Três colunas: **marca à esquerda**, **Navegação + Atendimento coladas à direita**, vazio no meio.
Feito com `ms-lg-auto` na Navegação e `col-lg-auto` nas duas (largura do conteúdo, não fração da grade).

Ícones sociais: Instagram, Facebook, WhatsApp. **Instagram e Facebook ainda apontam para a home
das redes** — marcados com `<!-- TODO -->`.

---

## 3. Páginas de curso — estrutura comum

Todas seguem o mesmo esqueleto:

```
Hero (imagem de fundo + logo EINAI + logo do curso + headline + CTA)
 └ Bloco de abertura (pergunta que provoca)
 └ Sobre o curso (imagem + texto + CTA)
 └ Grade de temas (fundo colorido, cards com ícone)
 └ O que você leva (4 cards)
 └ Quem vai te conduzir (Anderson Ávila)
 └ Oferta (data, local, carga horária, preço, cronômetro)
 └ Checkout em 5 etapas
 └ Rodapé
```

### Checkout — 5 etapas

```
1. Cadastro    nome, nascimento, telefone, CPF, e-mail, empresa (opcional)
2. Endereço    CEP (busca automática), rua, número, bairro, complemento, cidade, UF
3. Perfil      motivos do interesse (múltipla escolha) → viram tags no CRM
4. Pagamento   Pix (QR + copia e cola) ou cartão (1x a 12x)
5. Conclusão
```

Autosave no `localStorage` com prefixo por curso.

### O que muda de uma página para outra

Ao clonar uma página de curso, **estes sete pontos precisam ser trocados** — se algum
escapar, dois cursos gravam no mesmo lugar e o preço de um aparece no outro:

| item | SER | PNL | Practitioner |
|---|---|---|---|
| doc de configuração | `settings/course_ser` | `settings/course_pnl` | `settings/course_practitioner` |
| sufixo dos ids | `-ser` | `-pnl` | `-practitioner` |
| prefixo do autosave | `einai_ser_` | `einai_pnl_` | `einai_practitioner_` |
| tag do cliente | Inscrição SER | Inscrição PNL | Inscrição Practitioner |
| busca do funil | `name.includes(...)` | idem | idem |
| título do negócio | `Inscrição SER - nome` | … | … |
| imagem do hero | `hero-ser.png` | `HERO1.png` | `hero-practitioner.png` |

---

## 4. Firebase

Projeto: **`einia-21bc1`**

### Coleções

| coleção | conteúdo |
|---|---|
| `clients` | nome, e-mail, CPF, telefone, endereço, nascimento, empresa, tags, classId |
| `deals` | title, contactName, email, phone, value, crmTags, **stage** (`lead` → `won`), pipelineId |
| `pipelines` | funis do CRM, um por curso |
| `classes` | turmas |
| `settings` | um documento por curso |

### Documento de configuração do curso

Campos lidos pela página (todos opcionais):

```
date              texto da data          → "30 de novembro, 01 e 02 de dezembro"
location          texto do local
priceText         preço formatado        → aparece na página e no checkout
priceCentavos     valor em centavos      → base do cálculo de parcelas
installments      número de parcelas     (padrão 12)
installmentPrice  valor da parcela       (se ausente, é calculado)
oldPriceText      preço riscado          (se ausente, o bloco fica oculto)
promoTimer        cronômetro de oferta   (se ausente, o banner fica oculto)
checkoutMode      'transparent' (padrão) ou outro
```

**Sem esse documento a página mostra "Carregando..." no lugar de preço e data.**
Ao criar um curso novo, criar o documento correspondente no painel admin.

### Cloud Functions de pagamento

```
processarPagamentoAsaas
consultarStatusPagamentoAsaas
processarPagamentoRede
```

---

## 5. Design System — site institucional

### Cores (`:root` do `styles.css`)

| token | valor | uso |
|---|---|---|
| `--einai-dark-bg` | `#001523` | fundo da página |
| `--einai-card-bg` | `#0C2836` | fundo dos cards |
| `--einai-card-hover` | `#12374a` | card em hover |
| `--einai-blue-accent` | `#48b4f2` | destaque, links, ícones |
| `--einai-blue-bright` | `#007bff` | gradiente de botão |
| `--einai-gold` | `#ffb703` | botão dourado, estrelas |
| `--einai-text-muted` | `#a0aec0` | texto secundário |
| `--einai-radius` | `24px` | raio padrão |

### Tipografia

**Aboreto** para títulos, **Poppins** para leitura.

| nível | tamanho | peso | fonte | caixa |
|---|---|---|---|---|
| H1 hero | 56px | 700 | Aboreto | mista |
| H2 seção | 32px | 700 | Aboreto | mista |
| H2 CTA final | 40px | 700 | Aboreto | mista |
| Card de treinamento | 20,8px | 700 | Aboreto | **alta** |
| Card de diferencial | 16,8px | 700 | Aboreto | **alta** |
| Título de rodapé | 18,4px | 700 | Aboreto | mista |
| Pergunta do FAQ | 16,8px | 600 | Poppins | mista (azul) |
| Corpo | 16px | 400 | Poppins | mista (cinza 75%) |

Títulos em branco puro. Corpo em cinza. Azul só em elemento interativo.

### Espaçamento

- Seções: **48px** acima e abaixo (`py-5`), gap zero entre elas
- Bloco de título → conteúdo: **48px** (`mb-5`)
- Hero: 130px / 90px · Rodapé: 70px / 30px (exceções propositais)

> Cuidado: as classes utilitárias do Bootstrap usam `!important`. `style="padding: 140px"`
> inline **não** sobrescreve `py-5` — já teve código morto nesse formato no projeto.

### Animações

| efeito | onde | curva |
|---|---|---|
| Reveal on scroll | seções e cards | `cubic-bezier(.16,1,.3,1)`, 0.8s, delays de 0,15s |
| Word reveal | h1 do hero | 1,6s, stagger 0,08s |
| Hover de card | treinamentos | zoom 1.05 na foto, painel por opacidade |
| Navbar auto-hide | scroll para baixo | `translateY(-100%)`, 0.4s |
| Orbs de fundo | página inteira | pulsos de 16s a 22s |

A curva `cubic-bezier(.16, 1, .3, 1)` é o padrão do projeto — equivale ao `expo.out` do GSAP.

---

## 6. Design System — páginas de curso

Cada curso tem **paleta própria, tirada da logo**. O esqueleto é idêntico; muda a cor.

| curso | cor principal | fundo de seção | botões |
|---|---|---|---|
| SER | azul-marinho `#00164E` | verde `#12362E` | dourado `#DEAA4D` |
| Introdução à PNL | ciano `#00FFEF` | verde `#12362E` | dourado `#DEAA4D` |
| **Practitioner** | roxo `#452F6A` + ouro `#F7AC11` | roxo `#2C1D45` | ouro `#F7AC11 → #C9820B` |

**Regra:** o fundo da seção é a cor principal da logo rebaixada em luminosidade — mesmo
matiz, escuro o bastante para texto branco. O verde de sucesso (`#10b981`) da tela de
conclusão **não muda**, por ser convenção universal.

---

## 7. Imagens

| pasta | conteúdo | formato |
|---|---|---|
| `assets/img/cards/` | fundos dos cards de treinamento | 760×1361, JPEG q80, 32–80 KB |
| `assets/img/logos/cards/` | logos dos cursos para os cards | PNG transparente, ~900px |
| `assets/img/logos/` | originais (.ai e .png) | não usados em produção |
| `assets/img/depoimentos/` | capas dos vídeos | 640×360, ~30 KB |
| `assets/img/treinamentos/` | fotos antigas dos cards | fora de uso |

**Fundos dos cards:** cada imagem foi gerada com luminosidade **oposta** à da sua logo —
logo escura pede fundo claro e vice-versa. É isso que dispensa plaqueta ou véu atrás da logo.

| card | logo | fundo |
|---|---|---|
| SER | marinho, lum 15% | claro |
| SER II | laranja, lum 50% | escuro e frio |
| Introdução à PNL | ciano, lum 50% | escuro e quente |
| Practitioner | roxo, lum 30% | claro |
| Coaching | verde, lum 13% | claro |
| SER Jovem | amarelo, lum 63% | escuro |
| Harmonização | azul-claro, lum 63% | escuro |

**Conversão de `.ai`:** arquivos Illustrator são PDF por dentro — abrem com PyMuPDF
(`fitz.open`), renderizam a 300dpi com `alpha=True` e recortam pelo canal alfa.

**Fundo branco → transparente:** usar a luminância como alfa e **recuperar a tinta original**
nas bordas suavizadas (`rgb = (rgb - 255*(1-k)) / k`), senão o antisserrilhado lava a cor.

---

## 8. Pendências

- [ ] Links reais do Instagram e Facebook no rodapé
- [ ] Documento `settings/course_practitioner` no Firestore (preço e data)
- [ ] Hero do Practitioner é provisório (montado a partir da foto do card)
- [ ] Logo do EINAI na seção "Quem vai te conduzir" do Practitioner destoa do roxo
- [ ] Informativo da Harmonização (único card sem descrição)
- [ ] Páginas de SER II, Coaching, SER Jovem e Harmonização
- [ ] Vídeo institucional pode migrar dos Depoimentos para Quem Somos
- [ ] Razão social e CNPJ nas páginas legais
- [ ] `.docx` e `.ai` estão versionados no git (~9 MB desnecessários)

---

## 9. Decisões que não são óbvias

Registradas para não serem "corrigidas" por engano depois:

1. **A animação do hero ignora `prefers-reduced-motion`** — o Windows do cliente reporta
   `reduce` e isso matava o efeito. O resto do site também ignora.
2. **O card de treinamento é um `<a>`, não um `<div>` com overlay.** O overlay via
   `::after` não vence o hit-test dentro do painel de hover.
3. **O painel de hover não se move**, só o texto dentro dele. Painel deslizando com topo
   opaco desenha um retângulo visível.
4. **As tags "CURSO" e "TREINAMENTO" têm larguras diferentes no CSS** (111px e 173px) de
   propósito: os SVGs têm proporções diferentes e largura igual renderiza letras de
   tamanhos diferentes. As larguras atuais igualam a altura das letras em 8px.
5. **Logos dos cards em cor original, sem plaqueta** — a legibilidade vem do contraste
   planejado com a foto de fundo.
6. **Termos e Política existem como páginas reais**, não como link para WhatsApp.
   Inclui o direito de arrependimento de 7 dias (art. 49 do CDC), que se aplica por a
   compra ser online, mesmo o treinamento sendo presencial.
