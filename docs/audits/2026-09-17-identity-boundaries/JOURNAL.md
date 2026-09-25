# HuGR-Orchestra — aprofundamento adicional

Produto: b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7.

## Passagem 1 — mapa e deduplicação
Inventário completo dos arquivos rastreados registrado; inventário não é leitura semântica integral. Issues existentes consultadas por GitHub, inclusive #15–#62 com lacunas de numeração correspondentes a PRs. As observações históricas são evidência de outras execuções, não testes desta rodada. Checkout novo e descartável; nenhuma edição no código de produção.

## Hipóteses abertas
Serão registradas à medida que a leitura chegar aos caminhos reais; nenhuma hipótese é issue confirmada.

## Passagem 2 — contratos e identidade
Compilação original de Atlas passou. Lidos produtores de transições e test-vacuity, oráculos, chaves, reducers, leitores, portas de CLI e testes existentes. Hipóteses: (a) um revert Git legítimo forma ciclo no grafo de estados de conteúdo; (b) nomes de testes sem qualificação por suite colidem no mesmo arquivo; (c) RevIndex memoiza um nome móvel como HEAD como se fosse SHA imutável. Nenhuma hipótese é declarada problema confirmado até observar controles no código original.

## Passagem 3 — execução pública e repetição
Três execuções independentes da implementação compilada original. Cada uma cria Git real, roda CLI original em subprocessos, reabre composeRuntime e lê persistência real. A→B→C deixa uma transição atual; A→B→A deixa zero; A→B→A→B aceita três ocorrências mas tem dois nós e zero atuais. Dois testes de nomes distintos ficam separados; nomes iguais em suites distintas colidem; inverter suites inverte a shape sobrevivente. RevIndex retido com HEAD retorna snapshot anterior, mas SHA novo e instância nova retornam estado correto. Nenhum verificador, reducer ou hash foi substituído.

## Passagem 4 — contraprovas e propagação de falha
Issues #68 e #69 publicadas com três execuções e suíte original (136/136, 15 arquivos). Em seguida: investigar se a CLI preserva o motivo de falha do parser; se nomes móveis afetam o produtor real retido; e se a falha de publicação do evento Consumed é distinguida de consumo já confirmado. O experimento Maestro usará Session/Database/Event reais, aprovados semeados como fixtures e executor contado sem modelo. Uma falha será injetada exclusivamente na publicação de Consumed antes de qualquer commit; isso não certifica a origem da aprovação nem reproduz uma falha física de disco.

## Passagem 5 — verificação independente e revisão das conclusões
As três hipóteses adicionais foram reexecutadas em três conjuntos independentes. O produtor retido recusa B→HEAD após HEAD passar de B para C; nova composição e SHA C explícito persistem corretamente. A falha real de parse é preservada pelo produtor mas perdida na CLI, inclusive em execução parcialmente bem-sucedida. No Maestro, a falha injetada ANTES da publicação de Consumed retorna approval-consumed com zero registros; o mesmo pedido funciona após restaurar o publicador. Controles: consumo efetivamente existente bloqueia corretamente e despacho normal cria exatamente uma sessão/uma execução contada.

Contraprovas: 136 testes Atlas originais (15 arquivos) e 58 testes originais Maestro/Task (8 arquivos) passaram. Nenhuma conclusão foi baseada apenas em suíte verde. Quatro blobs de fonte foram comparados com respostas independentes do GitHub e coincidem. #18 cobre eixos de composição capturados e watermark, não memoização de nomes de revisão; #49 cobre falha DEPOIS de consumo durável, não diagnóstico falso ANTES dele. Ambos foram relidos antes da publicação de achados separados.

Limites mantidos: aprovações Maestro são fixtures semeadas, o executor é contado e não chama modelo; a falha de publicação é injetada, não uma pane física de disco. A CLI Atlas e o parser/storage/governed doors são originais, sem gates ou hashes substituídos. Os registros de agentes legacy/V2 foram lidos, mas a seleção efetiva do aplicativo V2 não foi exercitada e não foi convertida em bug confirmado.

## Publicação e revisão final
Issues #68, #69, #70, #71 e #72 criadas pelo conector GitHub, com retorno confirmado de estado open. O comando portátil do identity-runtime foi executado com HUGR_AUDIT_REPO explícito e diretório de saída sem checkout próprio: exit 0. A cópia temporária do teste Maestro foi retirada de packages/opencode/test após comparação byte a byte com a evidência preservada. Diff de fonte de produção contra o SHA auditado permanece vazio. JSONs do pacote foram analisados novamente para conferir integridade estrutural.
