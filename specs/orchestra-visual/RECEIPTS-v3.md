# Recibos v3 — protocolo do executor

O schema do recibo é **2**; progress.json continua schema **1**. Gere recibos com receipt_template.py do pacote v3. Não troque só o schema de uma prova v2 para reaproveitar PASS.

## Campos obrigatórios

| Campo | Contrato |
|---|---|
| id | ID de task existente, não épico/issue/WP |
| head | SHA Git completo do código verificado |
| contract_sha256 | Digest calculado sobre o contrato atual da task |
| paths_changed | Caminhos relativos ao repositório dentro de write_paths e fora de exclude_paths; vazio permitido para verificação sem escrita de produto |
| axioms | Cinco grupos exatos; todos criterion_ids uma vez, com resultados sustentados por arquivos |
| artifacts | Caminho relativo à raiz do pacote → SHA-256 dos bytes da prova |
| commands | command, cwd, exit_code inteiro, log; pelo menos um positivo aprovado |
| review | status, head, method e arquivo de revisão |
| performance / visual / native | Três decisões explícitas; required exige PASS, scoped admite NOT_APPLICABLE com motivo estreito |

NOT_RUN, campo omitido ou estado arbitrário não libera a task. Falta de hardware não torna teste Electron inaplicável onde a task o exige. Um recibo negativo pode ser guardado para diagnóstico, mas não promove progress.json para PASS.

## Procedimento

```sh
python3 tools/receipt_template.py S17-W1-T2 --out evidence/S17/W1-T2.draft.json
# Executar, revisar e preencher dados reais.
python3 tools/seal_receipt.py evidence/S17/W1-T2.draft.json --out evidence/S17/W1-T2.json
python3 tools/validate_evidence.py S17-W1-T2 evidence/S17/W1-T2.json
python3 tools/select_work.py --repo /caminho/real/HuGR-Orchestra --jobs 4
```

O helper de hashes não muda status, não autentica resultados e não escreve progress.json. Não referencie o próprio recibo no inventário: isso criaria hash recursivo. Não copie fixtures sintéticas dos testes como prova do produto. Arquivos de saída novos não são sobrescritos silenciosamente.

## Categorias PASS

Cada categoria informa o mesmo head do recibo, build_sha256 de 64 caracteres hexadecimais e known_defects: []. Categorias aprovadas juntas representam o mesmo build. Calcule o hash do manifesto ordenado dos artefatos realmente testados; não use constante fictícia.

Visual contém screenshots PNG e review_file. O validador confere cabeçalho, dimensões e hash, não julga pixels, composição ou beleza. O executor abre as capturas e registra a comparação ao master e aos estados.

Performance contém metrics_file, JSON com kind=performance-evaluation, status, head, build_sha256, environment e gates. Native usa report_file e kind=native-evaluation. Cada gate tem id, status e array evidence. Os IDs listados em required_performance_gates e required_native_gates da task precisam aparecer e passar. Todos os arquivos citados também entram em artifacts. Um ID ou hash não substitui observação bruta, cálculo de métrica ou teste real.

Chrome, overlays, Dock e revisão final têm gates nativos diferentes, conforme PLAN.json. Não impor fechamento de tabs a uma task de chrome da janela; tampouco dispensar o teste de fechamento na task do Dock.

## Negativos e revisão

Controle negativo usa expected_failure=true booleano, negative_control não vazio, exit_code inteiro não zero e log. Pelo menos um comando positivo precisa passar. Uma falha imprevista não vira teste negativo apenas por renomear um campo.

self-cold-review significa releitura do autor, não independência. independent-agent só quando outro agente realmente revisou; human só quando houve revisão humana. A ferramenta valida formato, não autentica o revisor. Reexecutar testes não substitui inspeção visual.

## Invalidação

Critérios, steps, caminhos, dependências, gates e locks mudados alteram o digest da task. Reavaliar o contrato, não atualizar digest à mão. Bytes alterados de provas invalidam hashes. Rehash não transforma conclusão errada em correta.

Com --repo o seletor usa Git somente em leitura para ancestry, mudanças commitadas e dirty/untracked. Código relevante alterado torna a prova STALE. A escrita dos próprios recibos e de progress.json não é mudança de produto; hashes continuam protegendo provas. Mapas, fixtures, contratos e DELIVERY.md não recebem exceção genérica.

Sem --repo, source_revision_verified=false: é verificação offline de plano/recibos, não frescor do checkout. Cones declarados não calculam automaticamente todos imports transitivos. Atualizar o censo após mudança de dependência e repetir os gates integrados.

Os validadores são barreiras estruturais, não certificação semântica do aplicativo. Fonte real, comportamento, acabamento e performance precisam ser demonstrados pelo executor.
