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
2. Testes de falha/reconexão do Redis, recuperação de tarefas ativas e cancelamento durante FFmpeg. O fluxo normal com Redis real e AOF no Windows passou em 29/10/2026.
3. FFprobe dentro da imagem Linux; o binário Windows foi usado no teste real.
4. TikTok e cobertura ampliada de Instagram: o post de Instagram fornecido em 29/10/2026 foi validado, mas isso não garante compatibilidade universal. TikTok permanece sem teste real autorizado.
5. Publicação, TLS e limitação por usuário na borda. Nenhum serviço público foi publicado.
6. Safari/iOS e dispositivos físicos, auditoria formal de acessibilidade, teste de carga, estabilidade prolongada e auditoria independente de segurança.

## Correções e validação local — 29/10/2026

- Corrigida a reutilização de `requested_formats` de uma seleção anterior do yt-dlp, que podia substituir o fluxo escolhido e provocar downloads indevidos/403.
- Preservados os cookies anônimos da sessão de extração nos downloads, sem acessar cookies do navegador do usuário.
- Metadados sem duração ou sem nome de codec deixam de ser interpretados como vídeo inválido. FFprobe verifica duração e faixas reais após o download.
- Adicionada dependência `curl-cffi`, usada pelos extratores que requerem compatibilidade de cliente HTTP, e suporte à URL curta `/t/` do TikTok. Não equivale a teste real de TikTok.
- Mensagens distintas para recusa 403, limite 429, conexão, exigência de login e ferramenta local ausente. Diagnóstico registra tipo/local do erro sem copiar URLs assinadas.
- 67 testes Python e 30 testes Playwright desktop/mobile aprovados; build de produção Next.js e TypeScript aprovados.
- Fluxo real validado: Next.js → FastAPI → Redis 8.10.3 para Windows (distribuição comunitária redis-windows) → worker com subprocessos → proxy HTTPS → yt-dlp → FFmpeg/FFprobe → entrega HTTP. Sem FakeRedis nesse fluxo.
- Instagram `DehIc5YR6_L`: arquivo MKV de **26.384.241 bytes**, VP9/AAC, **1080×1920, 60 fps**, **104,603 s**.
- YouTube `-Iy9J0lemNo`: arquivo MKV de **204.447.991 bytes**, H.264/AAC, **1920×1080, 60 fps**, **366,387 s**.
- Os dois arquivos completos foram recebidos pela rota de download do aplicativo e inspecionados com FFprobe. A mídia não faz parte do repositório.
- Serviços locais vinculados a `127.0.0.1`; este modo Windows não tem o isolamento de rede do Docker Compose e não deve ser exposto publicamente.

## Nimbo livre — 29/10/2026

- Pet flutuante em desktop e celular, sem faixa reservada nem alteração da largura da página.
- Arrasto em X/Y, setas de teclado, posição proporcional persistida e contenção após redimensionar.
- Passeio automático opcional com estado walking, passos alternados, balanço dos braços, orientação e cauda; orelhas com pequenos movimentos assimétricos em repouso.
- Passeio pausa ao interagir, em menus, durante tarefas, no repouso, com movimento reduzido e em aba oculta. Deslocamento automático evita controles visíveis; arrasto manual pode posicionar livremente sobre a interface.
- Botão direto para esconder, minimizar/restaurar e reativação por Configurações → Mostrar Nimbo.
- 34 testes Playwright passaram. Após o ajuste da posição inicial móvel, repetidos os testes de pet e capturas. Build de produção e TypeScript aprovados.
- README e capturas atualizados. As correções de download documentadas acima fazem parte da mesma atualização.

## Verificações operacionais pendentes

Execute o Compose, confira a saúde da API e heartbeat do worker, repita o fluxo autorizado pela interface até receber o arquivo, teste cancelamento em análise/download/processamento, interrompa e reinicie Redis/worker e confirme que tarefas não executam em duplicidade. Force expiração e falta de espaço. Verifique o bloqueio de loopback, link-local, IPv6 privado e redirecionamentos no container, e configure limites físicos do volume e proteção da borda.

Revalide cada plataforma separadamente e registre data, fonte autorizada e resultado. Mudanças das plataformas podem invalidar extratores mesmo sem mudanças no aplicativo.
