# Nimbo — direção artística e implementação

## Conceito

Companheiro original: pequeno mustelídeo imaginário de pelagem grafite, focinho claro, orelhas assimétricas, olhos âmbar e cauda cuja ponta lembra uma fita dobrada. A cabeça expressiva, corpo estreito, patas curtas e cauda lateral definem a silhueta. A assimetria das orelhas e o tufo da testa ajudam a reconhecê-lo parado.

Personalidade curiosa, gentil e travessa, expressa por postura, olhar e movimento. Sem diálogo ou funções de suporte. Não foram usados personagens, modelos, animações prontas ou sprites de terceiros.

Paleta: grafite `#252E39`, cinza `#818B96`, creme `#F7F1DC`, âmbar `#887A50` e rosa discreto `#BD9F9A`. A variação Névoa aumenta luminosidade e reduz saturação.

## Pesquisa e tecnologia

Referências técnicas: estados/blending do [Godot](https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html), [Rive](https://github.com/rive-app/help-center/blob/master/runtimes/state-machines.md), [Ticker do PixiJS](https://pixijs.com/8.x/guides/components/application/ticker-plugin) e [AnimationMixer do Three.js](https://threejs.org/docs/pages/AnimationMixer). Informaram a organização; nenhum personagem foi reproduzido.

Rive seria adequado com um arquivo `.riv` autorado no editor. PixiJS/Three.js acrescentariam um renderer e dependências desnecessários para um único personagem pequeno. A escolha foi SVG original com rig procedural, clips de poses e interpolação TypeScript. Não é um runtime Rive, um modelo 3D ou um sistema completo de física.

As skills frontend-design e vercel-react-best-practices orientaram identidade, carga separada, atualização sem renders React a cada frame e movimento reduzido.

## Módulos

| Arquivo | Função |
| --- | --- |
| `character.tsx` | Arte, gradientes, anatomia e articulações. |
| `motion.ts` | Dez estados, poses, prioridades e blending exponencial. |
| `nimbo.tsx` | Comportamento, interações, persistência, áudio e renderização. |
| `events.ts` | Eventos tipados emitidos pela página. |
| `pet.css` | Posicionamento flutuante, adaptação móvel e controles. |
| `wander.ts` | Passeio em dois eixos, limites da janela e prevenção de colisão com controles. |

## Movimento e comportamento

O rig separa corpo, cabeça, orelhas, braços, pés e cauda. Olhos têm pálpebra e pupilas independentes; sobrancelhas rotacionam e a boca altera sua curva Bézier. Respiração, cauda e pequenos movimentos assimétricos das orelhas usam fases distintas; piscadas têm intervalo variável. Saltos incluem antecipação, deformação moderada e retorno. Há no máximo três brilhos vetoriais na comemoração.

O motor aproxima a pose atual da pose-alvo com suavização dependente do tempo. Interações podem interromper clips; comportamentos espontâneos não substituem reações prioritárias. Durante tarefas de mídia não há cochilo ou brincadeira espontânea. A conclusão vem do estado da tarefa, não de um temporizador de progresso.

O arrasto é livre em dois eixos no desktop e no celular, limitado à janela e persistido em coordenadas proporcionais. As setas movem o pet quando ele tem foco. O passeio automático usa passos alternados, balanço de braços, cauda com atraso e orientação para o destino. Pausa em menus, foco, hover, arrasto, processamento e repouso; verifica controles antes de cada passo. O usuário pode estacioná-lo desativando Passear pela tela. Não há simulação física global; posicionamento manual pode cobrir um controle, por isso esconder/minimizar permanece acessível. O olhar é limitado. A inatividade leva ao cochilo; ações esporádicas usam intervalos aleatórios controlados.

## Acessibilidade, som e desempenho

O personagem é um botão com nome acessível, foco e ativação por Enter/Espaço. O menu usa controles nativos. Ocultação é persistida e reversível pelas configurações do site. Atalhos globais não são bloqueados.

`prefers-reduced-motion` ou a opção local substitui animações contínuas por poses estáticas. Abas ocultas suspendem o loop; timers/listeners são removidos ao minimizar, ocultar ou desmontar. Limite de 30 fps, sem textura externa ou WebGL.

O som é um chirp senoidal breve e baixo, opt-in, acionado apenas pelo toque direto. Oscilador/ganho são desconectados e o contexto é encerrado ao desmontar.

## Validação e limites

Playwright verifica poses finitas, blending, eventos, teclado, opções, persistência, ocultação/restauração, arrasto, sobreposição, cochilo, prioridades e pausa. Cenários de tarefa usam fixtures explícitas nos testes. Um teste adicional percorreu a interface e a API reais, baixou o vídeo autorizado em 360p/30 fps e verificou a comemoração ao final. Esse ensaio usou FakeRedis e um dispatcher de testes; não valida a infraestrutura Redis/Docker de produção. O resultado está em VALIDACAO-NIMBO.json.

Capturas reais orientam a revisão de anatomia, contraste e integração. Faltam medições de CPU/GPU/bateria em celulares físicos e validação Safari. O limite de frames e a pausa são controles implementados, não promessa de consumo zero.
