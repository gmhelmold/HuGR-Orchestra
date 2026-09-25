# HuGR-Orchestra — Atlas / Maestro: aprofundamento e evidências, rodada 2

**Base de produto:** `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`  
**Branch de produto:** `maestro/rebuild-fork-dev-clean`  
**Data:** 17 de setembro de 2026  
**Natureza:** investigação e documentação; não contém correções de produção nem autorização para considerar os defeitos resolvidos.

## Resultado desta rodada

Foram abertas seis issues novas, #32–#37, após conferir as 17 issues anteriores #15–#31. A revisão anterior está no PR #14. As descobertas novas não são uma republicação dos problemas anteriores de Knowledge/CAS, freshness de gotchas, orçamento de Own ou geração de receipts.

| Issue | Prioridade de engenharia | Descoberta | Evidência executada |
|---|---|---|---|
| [#32](https://github.com/gmhelmold/HuGR-Orchestra/issues/32) | P1 | Gravação de memória é confirmada, mas o registro novo se perde após uma cauda JSONL sem LF | Handler original, scanner real e releitura após reabrir |
| [#33](https://github.com/gmhelmold/HuGR-Orchestra/issues/33) | P2 | Cap de memória conta replay e versões históricas, não o conjunto efetivamente injetado | Handler e header originais sobre o mesmo log |
| [#34](https://github.com/gmhelmold/HuGR-Orchestra/issues/34) | P2 | Porta durável aceita seções do logbook rejeitadas pelo validador específico | Comparação de validadores e persistência real |
| [#35](https://github.com/gmhelmold/HuGR-Orchestra/issues/35) | P1, condicionado a publicações concorrentes | Rollback de A sobrescreve parte de uma publicação B já concluída | Função original, dois subprocessos reais, escalonamento controlado |
| [#36](https://github.com/gmhelmold/HuGR-Orchestra/issues/36) | P2, lacuna de integração | Host entrega Own obsoleto mesmo quando o verificador retorna HOLD | CLI materializadora + ferramenta skill reais; carregamento frio e quente |
| [#37](https://github.com/gmhelmold/HuGR-Orchestra/issues/37) | P2, adaptador/modelo | Orientation não representa retorno causal ao mesmo rótulo de estado | Adaptador e fold originais, arquivos reais e reabertura |

P1/P2 são prioridades propostas de engenharia, não escores de exploração. Nenhum caso demonstra incidente em dados reais de usuário. Cada issue inclui causa, escopo, contraexemplos, completeness criteria, success criteria, quality standards, definition of done e invariants.

## 1. O que foi feito — e o que não foi

A rodada teve cinco passagens com objetivos diferentes: reconciliação de versão/backlog; rastreamento dos caminhos de leitura e escrita; experimentos com controles; rechecagem das fronteiras públicas; revisão adversarial das conclusões e publicação. O diário registra a evolução e as hipóteses abandonadas.

**Isso não equivale a cinco leituras semânticas integrais de cada arquivo do monorepo.** O aprofundamento foi concentrado nas fronteiras Atlas/Memory/Own/Maestro, incluindo serviços do host, eventos e compactação. [SOURCES.md](SOURCES.md) informa o escopo por arquivo e o ledger contém os blobs conferidos. O inventário de arquivos não foi contado como entendimento do conteúdo.

A execução ocorreu em checkouts isolados em diretórios temporários no Mac autorizado. O checkout de referência estava limpo; a cópia de diagnóstico recebeu somente os testes adicionais. Dependências já instaladas foram reutilizadas. Foram registrados Node 22.17.1, Bun 1.3.14 e gitleaks 8.30.1. Houve typecheck e recompilação forçada do Atlas antes da repetição final. Não se afirma uma instalação limpa de dependências nesta rodada.

Não foram feitas chamadas a modelos pagos. O scanner recebeu somente as entradas sintéticas via stdin; não houve varredura de arquivos pessoais. Não foi alterada a implementação do produto para produzir os resultados.

## 2. Entendimento consolidado das fronteiras

### 2.1 Knowledge e Memory não têm o mesmo protocolo de persistência

Knowledge usa projeção e CAS; os problemas anteriormente registrados nesse caminho estão fora da novidade desta rodada. Memory usa registros versionados em um log JSONL append-only, com identidade de conteúdo e fold. A escrita append-only evita uma categoria de sobrescrita do arquivo inteiro, mas não resolve automaticamente a integridade do limite entre registros, nem torna atômicas as decisões anteriores ao append.

A porta pública de memória compõe derivação de tipo, validação de template, partição/proprietário, disciplina de logbook, cap de project memory, scanner e persistência. A qualidade de cada função isolada não prova que a composição selecionou o validador ou o conjunto correto. #33 e #34 exemplificam exatamente essa diferença: a aritmética do cap está correta para o conjunto recebido; o validator de logbook também está correto para sua própria chamada. O defeito está no conjunto passado e no validator que a porta durável deixa de chamar.

O log retorna um contador `rejected`. Essa informação é importante: encontrar bytes inválidos não significa encontrar um log saudável vazio. Entretanto, os leitores de nível superior consumidos nesta rodada extraem o conjunto de memória ou o fold, sem transportar esse contador no retorno. Em #32, um append posterior não aumenta esse contador: o registro novo foi concatenado à linha já inválida. O operador não recebe uma confirmação confiável de que o registro recém-admitido sobreviveu como unidade legível.

### 2.2 O cap deve nomear seu conjunto e sua unidade

`MEMBER_TOK_CAP` vale 500 e `ORCH_TOK_CAP` vale 800. A métrica usada nesse caminho é a contagem de palavras separadas por whitespace no texto da regra, não uma medição de tokens de modelo. Essa diferença está explicitada nos resultados.

A leitura de project memory reduz versões por texto da regra, calcula frecency efetiva pela posição no log e seleciona o slab. A escrita conta todos os registros históricos do proprietário e acrescenta novamente o candidato. Assim, arquivo de histórico, conjunto de regras correntes e conjunto injetado são três coisas distintas. Tratá-los como um só produz recusa de operações idempotentes e esgotamento artificial de um orçamento descrito como de injeção.

A correção deve preservar o histórico e manter limites genuínos. A auditoria não recomenda tornar memória ilimitada nem apagar versões antigas para esconder o problema. Uma quota de armazenamento, caso desejada, é outra política e precisa de outro nome e outra evidência.

### 2.3 Own possui uma fronteira de produção e outra de consumo

A materialização estática não é simplesmente texto autoassinado: a CLI original verifica revisão Git imutável/ancestral e os blobs ancorados antes de escrever os artefatos. A auditoria usou essa CLI para construir o caso do host. O verificador existente realmente detectou a mudança posterior da fonte.

A fronteira de consumo, porém, usa a descoberta genérica de skills. A ferramenta obtém o conteúdo por nome e o devolve. Não basta um prompt exigir Own atual se o consumidor não recebe uma decisão verificada ligada aos bytes carregados. #36 separa esse problema da cobertura do grafo (#29): um verificador de freshness correto não é automaticamente um oráculo de completude ou de verdade semântica.

Também existe uma fronteira de publicação: snapshot e diretório de skills são substituídos em passos distintos. O script admite que não é crash-atomic; isso já era um limite documentado e não foi reaberto como novidade. #35 é diferente: um processo vivo, fazendo rollback, remove estado instalado por outro processo que retornou sucesso. Nomes temporários exclusivos não resolvem a propriedade da geração atualmente publicada.

### 2.4 O Maestro não deve ser julgado como se toda a governança já estivesse disponível

A porta pública de apresentação de aprovação permanece indisponível até existirem leitores duráveis de plano e validação. O modo normal é separado do fluxo governado opt-in. Não se classificou a existência do modo normal como falha por si só.

A investigação de admissão/apresentação acompanhou a leitura da decisão, identidade determinística e publicação no serviço de eventos. A análise estática sugeriu uma possível corrida em retries. O experimento com os serviços reais não a confirmou: três rodadas de oito admissões idênticas concorrentes e três rodadas de oito apresentações idênticas concorrentes retornaram sucesso em todas as chamadas. Esse resultado refuta a alegação naquele cenário, sem provar ausência de toda corrida em qualquer processo ou escalonamento.

No despacho, o código examinado trata erros do assistant e de ferramentas retornadas pelo subagente. A hipótese de que esses erros seriam simplesmente ignorados foi descartada. A aprovação consumida antes de efeitos posteriores ainda merece desenho explícito de recuperação, mas esta rodada não promoveu esse aspecto a defeito demonstrado.

### 2.5 Orientation exige identidade causal, não somente identidade do texto

Orientation é um fold compartilhado de eventos de estado/marco; não é a memória privada de um membro. O adaptador atual nomeia um evento pelo hash de `{channel, label}`. Isso é suficiente para deduplicar a mesma mensagem, mas não distingue uma ocorrência posterior do mesmo rótulo com outro predecessor.

O caso `running -> blocked -> running` mostrou o problema sem edição manual de eventos. O terceiro append é uma ocorrência causal nova, mas tem a identidade da primeira. O fold mantém duas identidades e termina em blocked. O caso com terceiro rótulo novo termina corretamente.

A leitura está conectada ao runtime, mas não foi localizado um produtor automático de appends no caminho de produção inspecionado. Portanto #37 é apresentado como defeito do adaptador/modelo, não como observação de uma sessão real que mudou de estado e travou. A correção precisa tratar compatibilidade dos logs e dos apontadores de supersession; não é seguro apenas introduzir um nonce ou mudar um hash isoladamente.

## 3. Resultados reproduzidos

### 3.1 #32 — confirmação não implica releitura

Em um Git fixture com uma regra A válida, deixamos um fragmento incompleto no fim do log sem LF. A porta pública aceitou uma regra B diferente. Após reabrir o runtime e o store, somente A permaneceu legível. O retorno de B foi `ok:true` e `admitted:true`.

O controle saudável retornou dois registros. O controle com uma linha inválida **já terminada** também retornou dois registros e um rejeitado. Somente a ausência da quebra entre a cauda existente e o novo evento impediu a leitura de B. A evidência está em `memory-round2*.json`; o script usa dados pequenos e scanner real.

### 3.2 #33 — replay de 300 palavras é recusado

Primeira gravação: aceita, uma regra de 300 palavras. Replay idêntico: over-cap, mesmo com apenas uma regra de 300 palavras no header e no fold lógico. Controle de 250 palavras: replay aceito, uma única regra lógica.

Outra sequência grava a mesma regra de 100 palavras com frecency 1 a 6. Cinco versões são armazenadas; a sexta é recusada. O header tem uma regra e 100 palavras. Os dois casos compartilham a seleção incorreta do conjunto de orçamento.

### 3.3 #34 — validator existe, mas não governa a porta durável

Uma seção shipped de 280 caracteres é aceita pelo validator e pela porta. Com 281, o validator devolve `section over cap`, mas o handler grava. Seção vazia ou com espaços também é gravada, embora o validator devolva `unfilled section`. O restante do template está completo e cada caso tem seu próprio PR id.

Isso prova a divergência entre o caminho de biblioteca e o caminho durável, não que todo o template seja ignorado. Tipos, autorização e scanner continuam sendo avaliados no caminho exercitado.

### 3.4 #35 — rollback remove uma publicação alheia

Em três repetições, A parou após instalar seu snapshot, antes das skills. B concluiu a substituição completa e retornou sucesso. A voltou, recebeu ENOTEMPTY ao instalar skills, removeu snapshot B no rollback e restaurou o antigo. Resultado: snapshot antigo, skills B.

A instrumentação introduz somente uma barreira após um rename real, usando uma dependência já prevista pela função. Os writers são processos diferentes. Não se mediu a frequência espontânea desse escalonamento, nem se simularam falta de energia, semânticas de NFS ou validação completa de snapshots no experimento de publicação. O controle serial A/B termina consistente.

### 3.5 #36 — freshness HOLD, skill ainda entregue

Três casos usaram a CLI materializadora original e o host original. Fonte atual: READY, skill entregue. Fonte alterada antes do primeiro carregamento: HOLD, skill antiga entregue. Fonte alterada depois do primeiro carregamento: HOLD, skill antiga entregue novamente.

Os testes de stale-cold e stale-warm falham propositalmente na expectativa de não entregar o conteúdo obsoleto. A fixture concede a permissão da ferramenta; não testa autorização. Não há chamada de LLM, e nenhum resultado é apresentado como aprovação/execução governada completa.

### 3.6 #37 — três linhas, dois eventos, estado antigo

O adaptador gravou três linhas de estado, com supersedes corretamente fornecido em cada transição. Quando o terceiro rótulo é running de novo, a leitura retorna blocked, dois eventos lógicos e zero rejeitados. Quando o terceiro rótulo é complete, a leitura retorna complete.

O ponto importante é a diferença entre repetir uma entrega e repetir o valor de um estado em outro momento causal. Deduplicar a primeira é correto; apagar a segunda não é.

## 4. Registro de verificação

| Execução desta rodada | Resultado | O que comprova |
|---|---|---|
| `npm run typecheck` | exit 0 | Checagem do Atlas com dependências presentes |
| `npm run build -- --force` | exit 0 | Recompilação do Atlas original para repetição dos probes |
| Suite original de memória/Orientation | 17 arquivos, 158 testes passam | Controles existentes; repetida depois do rebuild |
| Suite original de Maestro + host skills | 9 arquivos, 51 testes passam | Controles existentes do host; não uma sessão com LLM |
| Probe de memória | 12 cenários; expectativas de defeito retornam exit 1 | Casos adicionais sobre módulos originais |
| Probe de publicação Own | 1 controle serial + 3 interleavings | Falha reproduzida na transação real |
| Probe concorrente Maestro | 1 teste agregado passa; 48 chamadas concorrentes | Suspeita não reproduzida no cenário executado |
| Probe de consumo Own no host | 1 cenário passa, 2 falham | Lacuna de freshness no carregamento frio e quente |

**209 testes originais passaram**, sem contar repetições como testes novos. As falhas dos diagnósticos são expectativas desejadas que o produto atual não satisfaz; não são apresentadas como falhas da suíte original. Não foi reexecutada toda a suíte Atlas nesta rodada, e resultados extensos de rodadas anteriores não foram somados a esta contagem.

Os logs preservam stdout/erros e os arquivos `.exit` registram o exit code do comando de interesse. O processo shell de captura pode terminar em zero após escrever um `.exit` igual a um; o `.exit`, não o último echo do shell, é a autoridade para o resultado do teste.

## 5. Contraevidência e disciplina de conclusões

**Compactação:** a poda inspecionada marca `time.compacted`, mas mantém o output salvo. Não há base para afirmar que ela apaga a evidência durável de apresentação. Nenhuma issue foi aberta com essa acusação.

**Concorrência do Maestro:** os retries concorrentes reais concluíram. Uma leitura antes de uma escrita não bastou para demonstrar a corrida imaginada. Nenhuma issue foi aberta com essa acusação.

**Falhas de subagente:** TaskTool tem verificações explícitas para assistant.error e erro de tool no resultado. Não foi alegado sucesso indiscriminado.

**Integridade de Orientation:** o limite de verificação de envelope já é documentado no código. #37 não é sobre editar um envelope; é sobre appends legítimos que repetem um rótulo com outra causa.

**Freshness:** o verificador de Own funciona nos controles; o problema demonstrado é sua ausência no ponto de consumo. Hash correto não é automaticamente prova de semântica ou cobertura.

## 6. Prioridade de remediação e provas de fechamento

Primeiro, #32 e #35: impedir confirmação de dados não recuperáveis e impedir que rollback de uma operação destrua outra publicação. Os consertos precisam manter histórico, limites de autoridade e comportamento de recuperação explícitos. Não basta fazer os testes pararem de lançar erro.

Depois, #36: ligar validação/availability à entrega de ownership. Isso deve ser específico para Own; não transformar toda skill genérica em um objeto Atlas nem inventar uma consulta dinâmica proibida pelo protocolo.

Em paralelo, #33 e #34: compartilhar as políticas corretas entre leitura, escrita e validators. Para #37, tratar causalidade e compatibilidade de armazenamento antes de conectar um produtor automático de estados a essa representação.

Cada issue traz os cinco campos de aceite solicitados. O fechamento exige executar os casos negativos e os controles positivos no código corrigido, preservar a evidência antes/depois e revisar a jornada que realmente consome os resultados. Nenhuma dessas issues foi fechada ou corrigida nesta rodada.

## 7. Navegação e reprodução

- [Diário de investigação](JOURNAL.md): o que foi aprendido e o que foi descartado.
- [Fontes e limites de leitura](SOURCES.md): arquivos, foco e identidade Git.
- [Como reproduzir](REPRODUCING.md): comandos, dependências e limites de cada teste.
- `evidence/`: resultados estruturados, logs selecionados, comandos/exit codes e snapshots das issues.
- `probes/`: scripts que importam o produto original e testes que usam os serviços reais do host.

A pergunta que atravessa os seis achados é operacional: **a informação que autoriza uma conclusão continua válida exatamente onde ela é consumida?** Nesta rodada, os experimentos responderam essa pergunta em limites de registros, orçamento, validação de seções, publicação, consumo de contexto e identidade causal. Esse é um mapa mais preciso de onde o desenho já funciona e onde sua composição ainda não sustenta a garantia pretendida.
