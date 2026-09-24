# RJP Structures V1.7.4

Aplicação WebApp/PWA + Android (React + Vite + Capacitor) para **Vigas, Pórticos 2D e Treliças 2D**, com motor MEF, Betão Armado/EC2, pormenorização esquemática e interface em **Português de Portugal**.

## Base mantida — cargas avançadas em barras

A ferramenta **Carga** foi ampliada. Ao tocar numa barra de pórtico/viga é agora possível criar, editar e apagar individualmente:

- força concentrada transversal `Py` em qualquer posição `x`;
- força concentrada axial `Px` em qualquer posição `x`;
- momento concentrado em qualquer posição `x`;
- carga distribuída **retangular/uniforme**;
- carga distribuída **triangular crescente** `0 → q`;
- carga distribuída **triangular decrescente** `q → 0`;
- carga distribuída **trapezoidal** `q1 → q2`;
- qualquer carga distribuída pode atuar em todo o vão ou apenas num troço `a–b`.

As cargas em barras são definidas nos **eixos locais x/y**. Os valores negativos permitem inverter o sentido. Nas treliças, as ações continuam a ser introduzidas nos nós, de acordo com a formulação axial adotada.

O motor MEF converte estas ações em vetores nodais equivalentes usando as funções de forma da viga; as distribuições lineares são integradas numericamente por Gauss. Os diagramas `N`, `V` e `M` passam a considerar as descontinuidades de forças e momentos concentrados e a variação das cargas triangulares/trapezoidais.

Mantêm-se todas as capacidades da V1.7.2: criação do modelo de raiz, nós, barras, rótulas, apoios, mover/apagar elementos, WebApp/PWA e APK Android.

## Edição gráfica

Ferramentas disponíveis:

- **Selecionar** — escolher a barra ativa;
- **Nó** — criar nós;
- **Barra** — criar barras entre dois nós;
- **Rótula** — inserir/remover libertações de rotação;
- **Apoio** — Livre → Móvel → Articulado → Encastrado;
- **Carga** — Fx/Fy/Mz nos nós e forças/momentos/cargas distribuídas avançadas nas barras;
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

Os ficheiros JSON V1.7.4 guardam também a geometria livre e as rótulas.

## Motor estrutural

Unidades de entrada: geometria em m, ações em kN/kNm e q em kN/m. O solver trabalha internamente em N-mm, com `E` em MPa, `A` em mm² e `I` em mm⁴.

Suporta elementos frame 2D e treliça, cargas nodais, forças e momentos concentrados nas barras, cargas distribuídas retangulares/triangulares/trapezoidais totais ou parciais, apoios, reações, deslocamentos, N/V/M, deformada e libertações rotacionais de extremidade.

## Betão Armado / EC2

Mantêm-se os módulos de flexão, corte, armaduras mínimas/máximas, estribos, fissuração, deformação, tensões de serviço, recobrimento/durabilidade, ancoragens, emendas, pilares, lajes, punçoamento, sapatas, fadiga simplificada, pré-verificação de incêndio, pormenorização e mapa estimado de armaduras. Consulte `EC2_COVERAGE.md` para limitações e âmbito de cada módulo.

## Build

Requer Node >= 22.12 e < 25.

```bash
npm install --no-audit --no-fund
npm run build
```

O workflow Android usa Node 24 + Java 21 e publica o artefacto:

`RJP-Structures-V1.7.4-debug-apk`

O workflow WebApp publica no GitHub Pages e gera:

`RJP-Structures-V1.7.4-WebApp`

## WebApp / PWA

A mesma base pode ser instalada como PWA em computador, tablet ou telemóvel e continua a gerar o APK Android. Para GitHub Pages, selecionar **Settings → Pages → Source: GitHub Actions**.

## Ficheiros principais

- `src/App.tsx` — editor, interface e integração MEF/EC2;
- `src/structural.ts` — solver MEF e rótulas;
- `src/ec2.ts` — verificações EC2;
- `src/styles.css` — interface e acessibilidade;
- `.github/workflows/android.yml` — APK;
- `.github/workflows/webapp.yml` — WebApp;
- `CHANGELOG_V1_7_3.md` — alterações desta versão;
- `VALIDATION_V1_7_3.md` — ensaios das cargas avançadas;
- os changelogs/validações das versões anteriores são mantidos como histórico.


## V1.7.4 — Inserção guiada de cargas
Ao tocar no ícone **Carga**, a aplicação abre automaticamente o separador **Cargas**. O utilizador escolhe se a carga é aplicada num **nó** ou numa **barra**, seleciona a tipologia, localização e valor. Estão disponíveis Fx, Fy e Mz nos nós; nas barras, forças concentradas axial/transversal, momento concentrado e cargas distribuídas retangulares, triangulares e trapezoidais, totais ou parciais. Também é possível tocar diretamente num nó ou numa barra para preencher o local de aplicação.
