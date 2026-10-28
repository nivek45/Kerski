# Arquitetura e decisões — Kerski

## Estrutura

```text
Navegador → Next.js /api → FastAPI → Redis (fila e estado)
                                      ↓
                               Worker supervisor
                                      ↓
                              Processo por tarefa
                             ↙                  ↘
                  yt-dlp → proxy HTTPS     FFmpeg / FFprobe
                             ↓                  ↓
                       Fontes públicas    Volume temporário
```

O navegador não recebe URLs assinadas de streams, comandos ou estruturas internas do extrator. Recebe apenas metadados normalizados, IDs de formatos e os dados da tarefa. Ao baixar, o worker consulta novamente a fonte e valida que a seleção ainda existe.

`security.py` valida URLs e nomes. `media.py` normaliza formatos, seleciona streams, baixa, inspeciona arquivos, faz remux/conversão e ZIP. `store.py` encapsula Redis e retenção. `models.py` define entradas e transições. `api.py` implementa análise assíncrona, criação/cancelamento/consulta e entrega por streaming de arquivo. `worker.py` gerencia execução, limites, cancelamento, recuperação de interrupções e limpeza. `infra/egress.py` controla saída HTTPS.

Os extratores específicos de YouTube, Instagram e TikTok vêm do yt-dlp e estão limitados por uma lista explícita. A normalização pública é comum; suporte a uma nova plataforma exige alterar a validação, a lista de extratores e os testes. Não existe extrator genérico habilitado como fallback.

## Estados e concorrência

`queued → analyzing → ready` para análise. `queued → downloading → processing → ready` para download. Estados ativos podem terminar em `failed` ou `canceled`; expiração é representada por HTTP 410 e pelo estado `expired` na interface.

O Redis move o item atomicamente da fila para a lista de tarefas ativas. Um lease impede dois supervisores. O supervisor renova esse lease durante o processamento; perda do lease encerra seu processo filho. Na retomada, tarefas interrompidas são marcadas como falhas, sem executar novamente o mesmo item automaticamente. Aumentar paralelismo exige particionar leases e supervisores; não escalar o serviço atual indiscriminadamente.

## Modelo de segurança

- URLs HTTPS em hosts exatos, com caminhos reconhecidos; sem credenciais embutidas, portas alternativas ou playlists.
- A validação inicial não é a única barreira: os destinos de conexão do extrator são verificados pelo proxy e a rede interna bloqueia saída direta no Compose.
- O proxy aceita CONNECT na porta 443. DNS é resolvido antes da conexão; qualquer IP não público entre as respostas bloqueia o destino. A conexão usa o IP verificado, mantendo TLS fim a fim com o host de origem.
- Redirecionamentos para HTTP não passam pelo proxy. Isso pode reduzir compatibilidade, deliberadamente.
- FFmpeg e FFprobe recebem listas de argumentos, nunca shell interpolado. Os arquivos de entrada são locais.
- Docker sem privilégios, capacidades removidas, filesystem principal somente leitura e limites de CPU, memória e processos para worker.
- Limites de duração, bytes, fila, tempo, espaço total e tamanho de saída; cotas físicas de volume continuam sendo responsabilidade do deploy.
- Metadados são renderizados como texto pelo React. Sem HTML externo inserido na página.
- API não devolve URLs internas do extrator; erros do yt-dlp não são expostos diretamente. Logs do worker contêm evento, tipo e estado, sem URL ou token de tarefa.
- Arquivos são servidos apenas se listados no resultado da tarefa e resolvidos dentro do diretório de saída daquela tarefa.

## Direção visual

Preto `#050505`, superfície `#101010`, borda `#262626`, texto `#F4F4F4`, secundário `#969696`. No claro: fundo `#FAFAFA`, superfície branca, texto `#151515`, secundário `#626262`. Tipografia Segoe UI Variable/Segoe UI local, sem carregamento de fonte de terceiros. O monograma K e o título são os elementos de identidade; o campo de link é o foco funcional.

Hero centralizado; resultado alinhado à esquerda; seleção compacta de quatro modos. No celular, o botão principal ocupa a largura do campo e os controles passam para duas ou uma coluna. Preferência de tema persistida com versão e script inicial antes da hidratação. Movimento reduzido respeitado.

## Pesquisa e skills

Consulta em 28/10/2026:

- [Next.js — instalação](https://nextjs.org/docs/app/getting-started/installation): Next 16.4.3; os guias distribuídos no pacote também foram lidos para componentes e empacotamento.
- [FastAPI — tarefas de background](https://fastapi.tiangolo.com/tutorial/background-tasks/): processamento pesado separado da API, com fila e supervisor.
- [yt-dlp — documentação](https://github.com/yt-dlp/yt-dlp) e [EJS](https://github.com/yt-dlp/yt-dlp/wiki/EJS): pacote default com componente EJS e Node 24 no container. Não há download dinâmico de componentes remotos.
- [shadcn/ui — Button](https://ui.shadcn.com/docs/components/button): componente de botão em código próprio seguindo a composição de variantes e Slot. Não foi adicionado o kit inteiro.
- [pytest](https://docs.pytest.org/en/stable/) e documentação local de Playwright para testes.
- [Catálogo skills.sh](https://www.skills.sh/topic/react) e [skills da Vercel](https://vercel.com/docs/agent-resources/skills).

Foram inspecionadas e instaladas na pasta de trabalho as skills `react-best-practices` de `vercel-labs/agent-skills` e `frontend-design` de `anthropics/skills`. Aplicações concretas: tema antes da hidratação, nenhuma biblioteca pesada de animação, dados de metadados mínimos, layout móvel próprio, paleta e hierarquia planejadas e revisão por capturas reais. A instalação não altera automaticamente o catálogo global de skills deste chat.

As demais skills sugeridas não foram instaladas em lote: composição avançada, descoberta de skills e bibliotecas completas não eram necessárias para este núcleo. As skills locais Sites e skill-installer orientaram o fluxo. A hospedagem Sites utiliza Workers e não acomoda este backend Python/FFmpeg; por isso não foi criada uma publicação parcial sem serviço de mídia.

## Pendências de evolução

Publicação requer validação do Compose real, auditoria de dependências e da configuração de borda, teste de falha de Redis, reinício do worker e cancelamento de processos FFmpeg no Linux. Falta validar plataformas Instagram/TikTok com links autorizados. Histórico local, lotes, i18n e preferências de formatos foram adiados conforme a prioridade do núcleo. Não há autenticação ou cobrança nesta versão.
