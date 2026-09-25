# WP-HOST-01 — registro de execução

Norte: CONTINUIDADE.md em 8ff7f8c93f178edf6c18892bab1be68833ede4b2; produto b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7.

Pergunta: entrypoint -> runtime -> agente -> ferramentas -> validação Own -> contexto efetivamente consumido. Não alterar produção, ativar aprovação bloqueada, nem usar inferência paga. Preservar controles positivos e negativos. A revisão inclui cinco passagens focadas, não cinco leituras integrais do monorepo.

## Passagem 1 — preparação e topologia
Checkout isolado no produto fixado. Dependências instaladas reaproveitadas de checkout de auditoria anterior, não instalação hermética. Resultados prévios não contam como novas execuções. Rastreamento e testes ainda pendentes.

## Passagem 2 — consumidores e composição
Confirmado caminho legado serve/TUI -> Server -> handlers SessionPrompt; /api/agent é V2 e /agent é legado. Skill também vira slash command via Command, sem passar por SkillTool. Primeira fixture omitiu SessionProjector: sessões não projetadas e 9 erros de setup; não são defeitos do produto. Corrigida composição para incluir o projetor original, seguindo o teste original.

## Passagem 3 — execução no código original
68 testes originais selecionados passaram (49 Maestro/skill legado, 19 V2), sem sobreposição entre esses conjuntos. Atlas typecheck/rebuild passou. Diagnóstico inicial corrigido executou nove casos. Diagnóstico estendido executou doze casos, incluindo rota HTTP real em processo -> sessão -> ferramenta -> HTTP do provedor local. Fonte modificada/deletada retorna HOLD no verificador original mas claim alcança request. Slash command também injeta. Histórico conserva resultado antigo após nova edição, observado sem classificar isoladamente como bug. HTTP /agent e /api/agent exercitados com/sem configuração.

## Passagem 4 — contraevidência e repetição
Reexecutando os dois diagnósticos em processo novo e fixtures independentes. Separar resultado observado de garantia desejada com verificador de evidências independente. Confirmação de fonte: nenhum arquivo lido diverge de b0c33d2; 284 JS compilados comparados são idênticos ao checkout de dependências; produção sem diff. Inventário global: 7.876 arquivos regulares e 60 symlinks = 7.936 entradas; resolve diferença de contagem histórica, sem reivindicar leitura semântica.

## Passagem 5 — revisão das conclusões e preparo da publicação
Segunda execução concluída: os 14 casos repetem os resultados e não há divergência nos campos semânticos comparados. Verificador independente releu as mensagens: 5 controles corretos e 6 violações em cada conjunto. Histórico retido não foi pontuado como defeito; o controle configurado refuta indisponibilidade global de Maestro no V2. SDK/v2 usa endpoints legados identificados no código, evitando inferência pelo nome.

Revisados os limites: roteador da aplicação em processo, HTTP de provedor local real, respostas programadas, SQLite em memória, permissões aceitas na fixture e nenhum restart da mesma sessão persistida. Digest de request completo não é anunciado como recomputável de um subconjunto publicado. Inspeção de padrões não encontrou tokens privados ou HOME pessoal.

Uma tentativa grande de gravação documental foi bloqueada antes da execução. Confirmada ausência dos arquivos, eles foram escritos por operações explícitas. O bloqueio não entra como teste ou publicação. Índice e norte foram atualizados sem apagar a revisão documental histórica. Publicação remota e leitura de retorno serão confirmadas separadamente; ainda não são atribuídas a esta etapa.
