# Kerski

Plataforma de análise, download e processamento de mídia autorizada. Interface em português, temas escuro/claro/sistema, Next.js + FastAPI + Redis + yt-dlp + FFmpeg.

**Estado: versão inicial em validação. Não está aprovada para produção.** Há código real de extração, download, processamento e entrega; os limites de verificação estão em `VALIDACAO.md`.

## Executar o conjunto completo

Requisitos: Docker Engine/Desktop com Docker Compose, acesso à internet e pelo menos 10 GB livres. Na pasta deste README:

```sh
docker compose up --build
```

Acesse http://localhost:3000. O Compose publica apenas a interface no endereço local. API, Redis e worker permanecem em rede interna. O primeiro build baixa dependências; não é possível iniciar esse conjunto apenas abrindo um arquivo HTML.

O host usado na implementação não tinha Docker nem WSL instalados. A configuração Compose foi escrita, mas a execução conjunta e o isolamento de rede precisam ser validados em um host com Docker antes de publicar.

## Desenvolvimento da interface

```sh
cd frontend
npm ci
npm run dev
```

Por padrão, `/api/*` é encaminhado a `http://127.0.0.1:8000`. Sem API, Redis e worker disponíveis, o aplicativo informa indisponibilidade; não gera formatos ou progresso fictícios. Defina `API_ORIGIN` antes de iniciar ou compilar para outro endereço interno.

## Testes

```sh
cd backend
python -m venv .venv
# Ative o ambiente virtual conforme o sistema operacional.
python -m pip install -r requirements-dev.txt -c requirements-tested.txt
python -m pytest -q
```

Os testes de mídia geram uma imagem azul e uma onda senoidal localmente. Nenhuma mídia de terceiros é necessária para essa suíte. FFmpeg para esses testes vem de `imageio-ffmpeg`; o container usa FFmpeg e FFprobe do sistema.

```sh
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
npm run build
```

Para um Chrome já instalado, defina `PLAYWRIGHT_EXECUTABLE_PATH` com o caminho do executável. A suíte cobre desktop e viewport móvel com Chromium; não equivale a validação no Safari real. As respostas de plataforma são substituídas por fixtures **apenas nos testes de navegador**.

## Comportamento de mídia

- A análise consulta a fonte e lista somente formatos encontrados, excluindo DRM e protocolos não admitidos.
- O modo automático escolhe a maior resolução, taxa de quadros e bitrate encontrados, sem limite artificial de 1080p. Limites operacionais de tamanho/duração continuam aplicáveis.
- Vídeo + áudio: remux sem recodificação, MKV por padrão. MP4 é opcional e pode ser incompatível com os codecs originais.
- Somente vídeo: remove a faixa de áudio, preservando o codec de vídeo.
- Somente áudio: preserva o codec original em MKA ou converte para M4A, MP3, Opus, WAV ou FLAC.
- Separados: entrega os dois arquivos e, opcionalmente, um ZIP sem recompressão.
- WAV e FLAC não recuperam informação perdida em uma fonte comprimida.
- Não há upscale, remoção de marca-d'água, importação de cookies, login em plataformas ou desbloqueio de DRM.
- Lives, playlists e conteúdos que exigem autenticação não são suportados nesta versão. A ausência de duração nos metadados não bloqueia o download; a duração real é conferida com FFprobe antes da entrega, mantendo limites de tamanho e tempo de execução.

## Limites operacionais

Valores padrão: 2 GiB por tarefa, 2 horas de duração, 1 tarefa em execução, fila de até 30 itens, 120 segundos para análise e 20 minutos para download/processamento. O worker reserva margem de disco para arquivos de trabalho e verifica um orçamento global de 10 GiB. O limite físico deve também ser imposto pelo volume da hospedagem.

Retenção de 1 hora **contada desde a criação da tarefa**. A limpeza ocorre no loop do worker; arquivos expirados deixam de ser servidos pela API mesmo antes da remoção física. Se o worker estiver parado, a remoção física espera sua retomada.

Percentual exibido por fluxo quando o tamanho é conhecido; processamento FFmpeg usa indicador indeterminado. A velocidade e os bytes vêm dos hooks de download. Não há percentual total inventado.

## Segurança e publicação

O Compose isola a saída do worker através de um proxy HTTPS que resolve DNS, rejeita qualquer resposta não pública e conecta ao IP já verificado. O proxy não publica portas no host. Não execute o worker fora dessa topologia como se tivesse a mesma garantia de isolamento.

Identificadores aleatórios de 256 bits funcionam como credenciais temporárias para tarefas e arquivos. Quem possui o endereço pode acessar a tarefa até expirar. Não compartilhe esses endereços nem registre caminhos completos de downloads em logs públicos.

O rate limit usa o endereço do cliente direto da API. Com o proxy Next.js, ele é conservador e compartilhado. Antes de atender usuários públicos, configure um proxy de borda confiável com limites por usuário/IP, TLS, limite de tamanho de requisição, cotas físicas de volume, monitoramento e autenticação conforme o modelo de negócio. Não confie em `X-Forwarded-For` recebido diretamente da internet.

## Documentação

- `ARQUITETURA.md`: decisões, módulos, segurança e pesquisa.
- `VALIDACAO.md`: testes executados e pendências.
- `previews/`: capturas reais da interface em desktop e celular.
- `backend/requirements-tested.txt`: versões resolvidas no ambiente de validação; aplicadas como constraints no build Python.
- `frontend/package-lock.json`: versões resolvidas do frontend.

Os arquivos de desenvolvimento instalados (`node_modules`, `.next`) não fazem parte do pacote de código-fonte.
