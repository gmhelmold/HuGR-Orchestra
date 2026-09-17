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
