# Leituras

App web (PWA) pessoal para registrar leituras de livros, artigos e posts de blog. Funciona como o TV Time, mas para leitura: você marca o que leu e o app soma o tempo estimado ("+45 min lidos"). Não tem cronômetro.

- Custo zero: sem servidor próprio e sem serviços pagos.
- HTML, CSS e JavaScript puro (ES modules), sem build e sem dependências.
- Dados no próprio aparelho (IndexedDB). Funciona offline, exceto a busca de livros e o backup.
- Instalável no celular, em português, com tema claro/escuro automático.
- Backup opcional numa pasta oculta do seu Google Drive.

## Sumário

1. [Como o tempo é calculado](#como-o-tempo-é-calculado)
2. [Rodar localmente](#rodar-localmente)
3. [Publicar no GitHub Pages](#publicar-no-github-pages)
4. [Instalar no celular](#instalar-no-celular)
5. [Configurar o backup no Google Drive](#configurar-o-backup-no-google-drive)
6. [Decisões e limites](#decisões-e-limites)
7. [Estrutura do projeto](#estrutura-do-projeto)

---

## Como o tempo é calculado

| Tipo | Cálculo | Padrão (ajustável em Configurações) |
|---|---|---|
| Livro | páginas lidas × minutos por página | 1,5 min/página; cada livro pode ter o seu (ex.: 2,5 para técnico ou devocional) |
| Artigo/blog: minutos | o que o site informa | — |
| Artigo/blog: tamanho | curto / médio / longo / muito longo | 5 / 10 / 20 / 35 min |
| Artigo/blog: texto colado | palavras ÷ palavras por minuto | 220 palavras/min |

- **Livros:** você informa "li até a página N". O app calcula as páginas desde o último registro e cria uma entrada com data e tempo. O botão **Terminei** completa até a última página.
- **Histórico:** cada marcação vira uma entrada (item, data, páginas, minutos). O total do app é sempre a soma das entradas. Você pode editar a data (para registrar leituras passadas), as páginas e os minutos, ou apagar uma entrada.
- Os minutos ficam **gravados na entrada**. Se você mudar o min/página depois, o histórico não é recalculado. Para corrigir um registro, edite-o.
- As datas usam o fuso **America/Sao_Paulo**. A semana vai de **segunda a domingo**.
- **Ritmo:** média de minutos por dia nos últimos 30 dias, comparada com os 30 anteriores.
- **Onde foi seu tempo:** leituras, autores e sites com mais tempo, por período (30 dias, este ano, sempre), com porcentagem e top 10.

### Formas de adicionar

- **Livro:** busca por título, autor ou ISBN no Google Books, na Open Library e na BrasilAPI (base brasileira da CBL, só por ISBN), tudo de uma vez. Se a fonte não tiver capa, o app tenta a capa pelo ISBN. Não achou? Cadastre à mão e **escolha uma foto como capa** (ela é reduzida e guardada no app).
- **PDF:** o app lê o título, as páginas, a **capa (1ª página)** e, em PDFs de até 80 páginas, o número de palavras. Você escolhe se ele é livro (progresso por página) ou artigo (lido de uma vez). O arquivo **não** fica salvo no app.
- **Artigo/blog:** tempo em minutos, **páginas** (× min/página), tamanho rápido ou texto colado.
- **Substack:** cole o link do post (`…/p/nome-do-post`). O app tenta buscar o título, o autor, a data de publicação, a imagem e o número de palavras (que vira o tempo de leitura). Se o site bloquear, preenche só o que dá para tirar do endereço.
- **Compartilhar (Android):** com o app instalado, no Substack ou no navegador toque em **Compartilhar → Leituras**, e o post abre já preenchido.

## Rodar localmente

É preciso ter o **Node.js 20 ou mais novo** (só para o servidor local e os testes; o app em si não usa Node).

```bash
npm run dev     # abre em http://localhost:5173
npm test        # roda os testes (node --test, sem dependências)
```

Sem Node, qualquer servidor estático serve, por exemplo: `python3 -m http.server 5173 -d docs`.

> **Durante o desenvolvimento:** o service worker guarda os arquivos em cache. Se uma mudança não aparecer, abra as DevTools → Application → Service Workers e marque **Update on reload**.

Os testes cobrem:
- tempo por páginas e por palavras;
- somas por semana e por mês;
- sequência de dias no fuso de São Paulo, inclusive leituras perto da meia-noite e o horário de verão antigo;
- progresso por página, edição e remoção de entradas;
- backup (validação, CSV);
- presença de todos os arquivos no cache offline.

## Publicar no GitHub Pages

O site publicado é só a pasta `docs/`. Outros arquivos do repositório, como o `relatorio_meta_automatico.html`, **não** são publicados.

1. Junte este branch na `main`: abra um Pull Request e faça o merge.
2. No GitHub, abra o repositório → **Settings** → **Pages**.
3. Em **Build and deployment** → **Source**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha `main` e a pasta **`/docs`**. Clique em **Save**.
5. Espere 1 a 2 minutos. O endereço será **https://richardriichard.github.io/HARD/**.

O GitHub Pages é gratuito para repositórios públicos. Seus dados de leitura **não** vão para o repositório; ficam no aparelho e, se você ativar, no seu Drive.

**Ao publicar uma versão nova do código**, aumente a versão em dois lugares (o teste confere se estão iguais):
- `docs/sw.js` → `const VERSION = '1.0.1'`
- `docs/js/ui/views/settings.js` → `export const APP_VERSION = '1.0.1'`

Os aparelhos então mostram o aviso "Nova versão do app disponível → Atualizar".

**Trocar o nome do repositório** (ex.: para `leituras`) muda a URL para `.../leituras/`. Os dados não se perdem, porque ficam ligados ao domínio `richardriichard.github.io`. Será preciso reinstalar o atalho no celular, e a origem autorizada do Google não muda.

## Instalar no celular

**Android (Chrome)**
1. Abra o endereço do app no Chrome.
2. Toque no menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).

**iPhone (Safari)**
1. Abra o endereço no **Safari**.
2. Toque em **Compartilhar** → **Adicionar à Tela de Início**.

No iPhone, o app instalado guarda os dados **separados** do Safari. Use sempre o ícone instalado e ative o backup.

Depois de instalado, o app abre e funciona sem internet. Só a busca de livros e o backup precisam de conexão.

## Configurar o backup no Google Drive

O backup é opcional; o app funciona 100% sem login. Ele usa o Google Identity Services direto no navegador, sem servidor. O escopo é o mínimo possível, **`drive.appdata`**: o app só enxerga uma pasta **oculta** própria no seu Drive, e nunca os seus arquivos.

Tudo abaixo é gratuito e não pede cartão. Os nomes dos menus do Google Cloud mudam com frequência; se algo estiver com outro nome, procure o equivalente.

### 1. Criar o projeto e ativar a API

1. Acesse https://console.cloud.google.com/ com a sua conta Google.
2. No seletor de projetos (topo), clique em **Novo projeto** → nome `Leituras` → **Criar**.
3. Com o projeto selecionado, vá em **APIs e serviços** → **Biblioteca**, procure **Google Drive API** e clique em **Ativar**.

### 2. Tela de consentimento (modo Teste)

1. Vá em **APIs e serviços** → **Tela de permissão OAuth** (em versões novas: **Google Auth Platform**).
2. Clique em **Começar** / **Configurar**:
   - Nome do app: `Leituras`
   - E-mail de suporte: o seu
   - Público: **Externo**
   - Contato do desenvolvedor: o seu e-mail
3. Em **Público** (ou **Usuários de teste**), mantenha o status **Em teste** e adicione **o seu e-mail** como usuário de teste.
4. (Opcional) Em **Acesso a dados** / **Escopos**, adicione `https://www.googleapis.com/auth/drive.appdata`.

Não é preciso publicar nem verificar o app: no modo Teste, só os e-mails da lista conseguem entrar.

### 3. Criar o ID do cliente

1. Vá em **APIs e serviços** → **Credenciais** (ou **Google Auth Platform** → **Clientes**) → **Criar credenciais** → **ID do cliente OAuth**.
2. Tipo de aplicativo: **Aplicativo da Web**. Nome: `Leituras web`.
3. Em **Origens JavaScript autorizadas**, adicione:
   - `https://richardriichard.github.io` (sem `/HARD` e sem barra no final)
   - `http://localhost:5173` (só se quiser testar no computador)
4. **URIs de redirecionamento autorizados:** deixe vazio (não é usado).
5. Clique em **Criar** e copie o **ID do cliente**, que termina em `.apps.googleusercontent.com`.

Não use a "chave secreta do cliente" (client secret): ela não é necessária e **nunca** deve ir para o código.

### 4. Colar o ID no app

1. No GitHub, abra `docs/js/config.js` e clique no lápis (**Edit**).
2. Cole o ID entre as aspas:
   ```js
   export const GOOGLE_CLIENT_ID = '1234567890-abc.apps.googleusercontent.com';
   ```
3. **Commit changes**. Em 1 a 2 minutos o Pages publica.

O ID do cliente **não é segredo**: ele fica visível no navegador de qualquer jeito. A proteção vem da origem autorizada (só o seu domínio) e da lista de usuários de teste (só você).

### 5. Conectar

1. Abra o app (com internet) → **Configurações** (engrenagem) → **Conectar com Google**.
2. O Google mostra "O Google não verificou este app". Isso é esperado no modo Teste: clique em **Continuar**.
3. Autorize o acesso à pasta de dados do app.

A partir daí:
- Cada alteração agenda um backup **30 s depois da última mudança**. O app guarda as **5 versões mais recentes** (arquivos `backup.json` na pasta oculta).
- Em **Configurações** ficam a conta conectada, o horário do último backup e os botões **Backup agora** e **Restaurar** (você escolhe a versão).
- Ao abrir o app logado, se o Drive tiver dados **mais novos** que os do aparelho (ex.: você usou outro aparelho), aparece um aviso perguntando se quer restaurar. **Nada é substituído sem confirmação**, e a confirmação mostra quantos itens e registros serão trocados.
- Para ver ou apagar os dados ocultos: Google Drive → **Configurações** → **Gerenciar apps** → Leituras.

### Limites do backup sem servidor

- **O login vale cerca de 1 hora.** Sem servidor, o navegador não pode renovar o acesso sozinho (a renovação abre uma janela, e janelas só abrem com um toque seu). Enquanto o login vale, o backup é automático. Depois disso, o app mostra **"Toque para sincronizar"**; um toque renova e envia o que estiver pendente.
- No modo Teste, o Google pode pedir para você confirmar a permissão de novo de tempos em tempos.
- **Dois aparelhos:** não há mescla automática. A versão mais recente vale, e as anteriores ficam guardadas (até 5). Se usar dois aparelhos, sincronize ao trocar de um para o outro.
- **Não testado num iPhone real:** o login do Google abre uma janela (pop-up). Em apps instalados na tela de início do iPhone, janelas assim às vezes não voltam para o app. Se acontecer, use **Exportar backup (JSON)** como alternativa.

### Sem Google: backup manual

Em **Configurações** → **Seus dados**:
- **Exportar backup (JSON):** baixa tudo (itens, registros e configurações).
- **Importar backup (JSON):** substitui tudo pelos dados do arquivo, com confirmação.
- **Exportar histórico (CSV):** para Excel ou Google Planilhas, com `;` e vírgula decimal.

## Ativar a chave do Google Books

Sem chave, o Google Books usa uma cota gratuita **compartilhada por todo mundo**, que acaba quase todo dia ("limite de buscas atingido"). Com uma chave sua (gratuita), você tem 1.000 buscas por dia.

1. No https://console.cloud.google.com/, selecione o projeto **Leituras**.
2. **APIs e serviços** → **Biblioteca** → busque **Books API** → **Ativar**.
3. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **Chave de API**. Copie a chave (começa com `AIza`).
4. Clique na chave criada para restringir:
   - **Restrições de aplicativo:** Sites → adicione `https://richardriichard.github.io/*`
   - **Restrições de API:** Restringir chave → marque só **Books API** → **Salvar**
5. No GitHub, edite `docs/js/config.js` e cole em `GOOGLE_BOOKS_API_KEY = '...'`. Commit.

A chave aparece no navegador (como todo app web), mas as restrições acima impedem o uso por outros sites e para outras APIs.

## Intermediário do Substack (Cloudflare, gratuito)

O Substack bloqueia a leitura dos dados dos posts direto pelo navegador. Sem configurar nada, o app tenta dois intermediários públicos gratuitos. Eles funcionam às vezes, mas são de terceiros, saem do ar e veem o link que você está lendo. Para funcionar sempre, crie o seu (10 minutos, uma vez só, sem cartão; o plano gratuito tem 100 mil usos por dia):

1. Crie uma conta em https://dash.cloudflare.com/sign-up (só e-mail e senha).
2. No menu lateral, abra **Workers e Pages** (ou **Compute (Workers)**) → **Criar** → **Criar Worker** (modelo "Hello World").
3. Dê o nome `leituras-proxy` e clique em **Implantar** (Deploy).
4. Clique em **Editar código**. Apague tudo, cole o conteúdo do arquivo [`cloudflare/worker.js`](cloudflare/worker.js) deste repositório e clique em **Implantar**.
5. Copie o endereço do Worker, algo como `https://leituras-proxy.SEU-NOME.workers.dev`.
   - Para testar, abra esse endereço no navegador: aparecer **"Origem não permitida"** é o esperado (o Worker só atende o seu app).
6. No GitHub, edite `docs/js/config.js` e cole o endereço em `LINK_PROXY_URL = '...'`. Faça o commit.

O Worker só aceita pedidos vindos de `https://richardriichard.github.io` e só repassa a API pública de posts (`/api/v1/posts/...`). Não guarda nada.

## Compartilhar do Substack para o app (Android)

O Android só coloca o app no menu **Compartilhar** quando ele é instalado com uma versão que já tem esse recurso (1.1.0 ou mais nova). Se você instalou antes, reinstale:

1. **Antes, faça um backup:** Configurações → **Backup agora** (ou **Exportar backup (JSON)**).
2. Desinstale o ícone **Leituras** (segure o ícone → **Desinstalar**).
3. Abra o endereço do app no **Chrome** (não em outro navegador) → menu **⋮** → **Instalar app**. Precisa ser "Instalar app"; "Adicionar à tela inicial" cria só um atalho, que não aparece no Compartilhar.
4. Abra o app. Se os dados não estiverem lá, conecte o Google em Configurações e restaure o backup.
5. No Substack, abra um post → **Compartilhar** → **Leituras**. Na primeira vez, o app pode estar em "Mais" no fim da lista.

No iPhone, o sistema não permite que apps web apareçam no Compartilhar; copie o link e cole no app.

## Decisões e limites

- **Busca de livros:** usa a Open Library e, como alternativa, o Google Books. Os dois são gratuitos e sem chave. Sem chave, o Google Books tem uma cota compartilhada e às vezes responde "limite atingido"; tente de novo depois ou use a Open Library. O total de páginas vem de uma edição média, então confira o da sua edição (é editável).
- **Capas offline:** ficam em cache só quando o servidor de imagens permite (CORS). As outras aparecem quando há internet. Sem capa, o app mostra as iniciais do título.
- **Dados locais:** apagar os dados do site no navegador apaga as leituras. O app pede ao navegador armazenamento persistente (veja em Configurações → Sobre), mas o backup é a garantia.
- **Substack:** não há login nem lista de leitura automática (o Substack não oferece isso). A leitura dos dados do post depende de um intermediário (o seu na Cloudflare ou os públicos); se nenhum responder, o app avisa e você completa o tempo.
- **Lojas (Amazon etc.):** não têm acesso gratuito pelo navegador; por isso a busca usa as três fontes acima e o ISBN.
- **Leitor de PDF:** pdf.js (Apache 2.0), incluído em `docs/vendor/pdfjs`, baixado só no primeiro uso e guardado para uso offline.
- **Fora do escopo:** cronômetro, redes sociais.

## Estrutura do projeto

```
docs/                     ← site publicado (GitHub Pages: main → /docs)
  index.html              ← casca do app (cabeçalho, conteúdo, abas)
  manifest.webmanifest    ← dados de instalação (PWA)
  sw.js                   ← service worker (offline e versão)
  css/app.css             ← estilos, tema claro/escuro
  icons/                  ← ícones do app
  js/
    app.js                ← inicialização e rotas (#/inicio, #/biblioteca…)
    config.js             ← Client ID do Google (backup)
    core/                 ← regras puras, cobertas por testes
      calc.js             ← tempo por página/palavras/tamanho, formatação
      dates.js            ← datas no fuso de São Paulo, semanas, meses
      progress.js         ← progresso por página, entradas, status
      stats.js            ← totais, semana/mês, tipo, sequência, concluídos
      transfer.js         ← formato do backup e CSV
    data/
      db.js               ← IndexedDB
      store.js            ← estado em memória + gravação
    services/
      books-api.js        ← Open Library e Google Books
      drive.js            ← login Google + API do Drive (appDataFolder)
      backup.js           ← backup automático, versões, restauração
      files.js            ← baixar/escolher arquivos
    ui/
      views/              ← telas: início, biblioteca, item, histórico, estatísticas, configurações
      sheets/             ← painéis: adicionar, busca, livro, artigo, progresso, registro
      …                   ← componentes, gráfico SVG, avisos, ícones
tests/                    ← testes (node --test)
.github/workflows/        ← roda os testes a cada push (GitHub Actions, gratuito)
```

### Modelo de dados (IndexedDB `leituras-db`)

- **items**
  - livro: `{ id, type: 'livro', title, author, totalPages, currentPage, minPerPage, coverUrl, isbn, source, status, startedOn, finishedOn, createdAt, updatedAt }`
  - artigo/blog: `{ id, type: 'artigo' | 'blog', title, site, url, minutes, timeMode, wordCount, status, finishedOn, … }`
  - `status`: `quero` | `lendo` | `lido` | `abandonado`
- **entries:** `{ id, itemId, date: 'AAAA-MM-DD', createdAt, pageFrom, pageTo, pages, minutes }`
- **kv:** `settings` (min/página, palavras/min, tamanhos) e `dataUpdatedAt` (quando os dados mudaram neste aparelho, usado para comparar com o Drive)
