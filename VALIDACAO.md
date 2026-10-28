# Validação — Kerski

Data: 28/10/2026. Esta é uma entrega inicial verificável, ainda não uma versão aprovada para produção.

## Resultados

| Verificação | Resultado e alcance |
| --- | --- |
| Backend | 62 testes automatizados: URLs, plataformas, SSRF, nomes, formatos, estados, payloads, API, fila com FakeRedis, rate limit com Lua, cancelamento solicitado, expiração, entrega de arquivo, path traversal, limpeza e processamento |
| FFmpeg | Execução real dos quatro modos e conversões M4A/MP3/Opus/WAV/FLAC com mídia sintética autorizada; regressão de remux HLS |
| Navegador | 30 testes Playwright aprovados em Chrome, desktop e viewport móvel, incluindo o Nimbo; APIs de plataforma substituídas por fixtures de teste |
| Interface | Tema e persistência, colar, URL inválida, resoluções, quatro modos, iniciar/repetir, cancelar, erros e ausência de overflow horizontal |
| Build | Compilação de produção Next.js aprovada no Windows; verificação TypeScript incluída |
| Visual | Capturas reais desktop/mobile em claro/escuro revisadas; disponíveis em `previews/` |

O backend emite um aviso de depreciação do adaptador de testes httpx/Starlette. Ele não causou falha dos testes; a migração da dependência de testes permanece como manutenção.

## Teste real do YouTube fornecido pelo usuário

Fonte autorizada para teste na conversa: https://www.youtube.com/watch?v=2_gVzBuDrNk

- Análise real aprovada: 622 segundos, 44 formatos retornados, máximo 1080p/60 fps.
- Download real aprovado pelo proxy HTTPS usando yt-dlp. Foram recebidos os fluxos de vídeo e áudio.
- Arquivo combinado inspecionado com FFprobe: H.264, **1920×1080**, **60/1 fps**, áudio AAC, duração **621,993 segundos**.
- Geração aprovada: combinado MKV, vídeo sem áudio, áudio sem vídeo e arquivos separados com ZIP.
- O primeiro teste revelou timestamps incompletos no fluxo HLS. Foi implementado remux intermediário MP4 para normalizar timestamps sem transcodificação; o teste passou após a correção.
- O progresso de fluxos HLS sem tamanho total conhecido fica indeterminado. Estimativas variáveis do extrator não são exibidas como percentual exato.

Esse teste executou a biblioteca real de mídia com armazenamento de estado FakeRedis dentro do processo de validação. **Não comprova a execução integral navegador → API → Redis real → supervisor Docker.** Nenhum mock de extração ou download foi usado no teste real do YouTube. Os arquivos de mídia utilizados no teste não estão incluídos no pacote de código-fonte.

## Validação adicional do Nimbo

O novo módulo passou pelos testes de poses, blending, eventos, teclado, preferências, persistência, ocultação/restauração, arrasto, sobreposição, cochilo, prioridade, movimento reduzido e pausa em aba oculta. Os testes dos quatro modos também verificam a comemoração a partir da resposta de conclusão da tarefa.

Um ensaio adicional usou a interface Next.js e a API FastAPI reais com yt-dlp/FFmpeg/FFprobe, baixando e recebendo um arquivo de **34.722.159 bytes, 360p/30 fps**, a partir do link autorizado. A interface recebeu o estado `ready` e o pet entrou em `excited`, sem erros JavaScript. O estado e a fila desse ensaio usaram FakeRedis e um dispatcher temporário; esses componentes de teste não são distribuídos com o aplicativo. Registro: [VALIDACAO-NIMBO.json](VALIDACAO-NIMBO.json).

Amostragem curta em Chrome desktop, usando a compilação de produção: 58 atualizações do rig em 2 segundos em cada viewport; cerca de 0,076–0,079 segundos de trabalho da página nesse intervalo. Após 12 ciclos de minimizar/restaurar e coleta de lixo, o heap aumentou aproximadamente 0,4 MB em cada sessão. São observações pontuais, não uma prova de ausência de vazamentos ou de desempenho em dispositivos físicos. Dados em [PERFORMANCE-NIMBO.json](PERFORMANCE-NIMBO.json). CPU/GPU/bateria em celulares físicos permanecem pendentes.

## Ainda não verificado

1. Docker Compose, rede interna, cotas e encerramento de árvores de processos no Linux. Docker e WSL estavam ausentes no host.
2. Redis real com persistência AOF, queda/reconexão, recuperação de tarefas ativas, renovação de lease e cancelamento durante FFmpeg.
3. FFprobe dentro da imagem Linux; o binário Windows foi usado no teste real.
4. TikTok, Instagram Reels e posts de vídeo do Instagram: validação de URLs e extratores configurados, mas **sem teste real autorizado**. Não são anunciados como compatibilidade garantida.
5. Publicação, TLS e limitação por usuário na borda. Nenhum serviço público foi publicado.
6. Safari/iOS e dispositivos físicos, auditoria formal de acessibilidade, teste de carga, estabilidade prolongada e auditoria independente de segurança.

## Antes de considerar produção

Execute o Compose, confira a saúde da API e heartbeat do worker, repita o fluxo autorizado pela interface até receber o arquivo, teste cancelamento em análise/download/processamento, interrompa e reinicie Redis/worker e confirme que tarefas não executam em duplicidade. Force expiração e falta de espaço. Verifique o bloqueio de loopback, link-local, IPv6 privado e redirecionamentos no container, e configure limites físicos do volume e proteção da borda.

Revalide cada plataforma separadamente e registre data, fonte autorizada e resultado. Mudanças das plataformas podem invalidar extratores mesmo sem mudanças no aplicativo.
