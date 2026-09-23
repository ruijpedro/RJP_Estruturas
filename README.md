# RJP Structures V1.7.2

Aplicação WebApp/PWA + Android (React + Vite + Capacitor) para **Vigas, Pórticos 2D e Treliças 2D**, com motor MEF, Betão Armado/EC2, pormenorização esquemática e interface em **Português de Portugal**.

## Novidades V1.7.2 — modelo criado de raiz

A geometria deixou de estar limitada aos modelos de exemplo. Agora é possível:

- carregar em **Novo** e iniciar o tipo de modelo atual completamente em branco;
- escolher **Nó** e tocar na grelha para criar nós com snap de 0,25 m;
- escolher **Barra**, tocar no nó inicial e depois no nó final para criar uma barra;
- usar **Mover** para alterar as coordenadas de um nó;
- usar **Apagar** para eliminar barras e nós, além de forças, cargas distribuídas e apoios;
- apagar um nó ligado a barras, com confirmação para remover também as barras associadas;
- regressar ao modelo de exemplo em qualquer altura.

### Rótulas / libertações de rotação

Foi acrescentada a ferramenta **Rótula**:

- ao ativá-la, aparecem pontos de seleção junto às duas extremidades das barras de pórtico;
- tocar numa extremidade insere uma libertação de rotação;
- tocar novamente remove a rótula e repõe a ligação rígida;
- a barra selecionada também apresenta botões **Inserir/Remover rótula inicial/final** no painel de propriedades;
- as rótulas fazem parte do modelo MEF, não são apenas símbolos gráficos.

O motor usa condensação estática das rotações libertadas. Uma barra biarticulada sob carga uniforme apresenta momentos de extremidade nulos; uma barra encastrada-articulada transmite momento apenas na extremidade rígida.

## Edição gráfica

Ferramentas disponíveis:

- **Selecionar** — escolher a barra ativa;
- **Nó** — criar nós;
- **Barra** — criar barras entre dois nós;
- **Rótula** — inserir/remover libertações de rotação;
- **Apoio** — Livre → Móvel → Articulado → Encastrado;
- **Carga** — editar Fx/Fy/Mz num nó ou qy numa barra;
- **Mover** — alterar coordenadas do nó;
- **Apagar** — barras, nós, apoios e ações.

O cálculo é atualizado automaticamente sempre que o modelo permanece estável. Se a edição criar um mecanismo, a app apresenta a mensagem de instabilidade em vez de devolver resultados inválidos.

## Interface e acessibilidade

Mantém:

- interface integralmente PT-PT;
- zoom 70–200%, grelha, rótulos e ações configuráveis;
- modo Foco;
- painel de propriedades recolhível;
- tamanho do texto 90–145%;
- escala independente dos textos do desenho;
- contraste reforçado e áreas de toque maiores;
- gravação automática, recuperação e JSON de projeto.

Os ficheiros JSON V1.7.2 guardam também a geometria livre e as rótulas.

## Motor estrutural

Unidades de entrada: geometria em m, ações em kN/kNm e q em kN/m. O solver trabalha internamente em N-mm, com `E` em MPa, `A` em mm² e `I` em mm⁴.

Suporta elementos frame 2D e treliça, cargas nodais, cargas distribuídas locais, apoios, reações, deslocamentos, N/V/M, deformada e libertações rotacionais de extremidade.

## Betão Armado / EC2

Mantêm-se os módulos de flexão, corte, armaduras mínimas/máximas, estribos, fissuração, deformação, tensões de serviço, recobrimento/durabilidade, ancoragens, emendas, pilares, lajes, punçoamento, sapatas, fadiga simplificada, pré-verificação de incêndio, pormenorização e mapa estimado de armaduras. Consulte `EC2_COVERAGE.md` para limitações e âmbito de cada módulo.

## Build

Requer Node >= 22.12 e < 25.

```bash
npm install --no-audit --no-fund
npm run build
```

O workflow Android usa Node 24 + Java 21 e publica o artefacto:

`RJP-Structures-V1.7.2-debug-apk`

O workflow WebApp publica no GitHub Pages e gera:

`RJP-Structures-V1.7.2-WebApp`

## WebApp / PWA

A mesma base pode ser instalada como PWA em computador, tablet ou telemóvel e continua a gerar o APK Android. Para GitHub Pages, selecionar **Settings → Pages → Source: GitHub Actions**.

## Ficheiros principais

- `src/App.tsx` — editor, interface e integração MEF/EC2;
- `src/structural.ts` — solver MEF e rótulas;
- `src/ec2.ts` — verificações EC2;
- `src/styles.css` — interface e acessibilidade;
- `.github/workflows/android.yml` — APK;
- `.github/workflows/webapp.yml` — WebApp;
- `CHANGELOG_V1_7_2.md` — alterações desta versão;
- `VALIDATION_V1_7_2.md` — ensaios efetuados.
