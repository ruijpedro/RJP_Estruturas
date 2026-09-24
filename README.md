# RJP Structures V1.7.5

Aplicação **WebApp/PWA + Android APK** (React + Vite + Capacitor) para **Vigas, Pórticos 2D e Treliças 2D**, com motor MEF, módulo de **Betão Armado EC2**, pormenorização esquemática e interface integralmente em **Português de Portugal**.

## Novidades da V1.7.5

A V1.7.5 consolida as melhorias anteriores do editor livre e repõe/expande o sistema de ações de barra. Uma mesma barra pode agora ter **várias ações simultâneas e independentes**.

### Ações disponíveis nas barras

- força concentrada transversal em qualquer posição da barra;
- força concentrada axial em qualquer posição da barra;
- carga distribuída uniforme, total ou parcial;
- carga triangular, total ou parcial;
- carga trapezoidal, total ou parcial;
- momento aplicado em qualquer posição da barra;
- várias ações do mesmo tipo ou de tipos diferentes na mesma barra;
- edição e eliminação individual de cada ação diretamente no desenho ou no painel **Cargas**;
- sinais positivos/negativos preservados;
- posições `x`, `x1` e `x2` medidas desde o nó inicial da barra.

O motor converte estas ações em forças nodais equivalentes consistentes e recalcula automaticamente reações, deslocamentos e diagramas **N/V/M**. Para treliças, as ações próprias de barra são limitadas a forças axiais; as ações transversais devem ser aplicadas nos nós.

### Novo modelo / editor livre

Ao escolher **Novo**, é possível iniciar por:

- modelo padrão;
- modelo em branco;
- apoios;
- barra sem nós visíveis;
- barra com nós;
- apenas nós.

As ferramentas **Nó**, **Barra** e **Apoio** criam geometria diretamente na grelha. A ferramenta **Carga** permite editar ações nodais (`Fx`, `Fy`, `Mz`) ou adicionar ações às barras. A ferramenta **Apagar** remove forças, momentos, ações de barra ou apoios.

### Acessibilidade e segurança do projeto

- tamanho do texto da interface: 90%, 100%, 115%, 130% ou 145%;
- escala independente para textos do desenho;
- contraste reforçado e áreas de toque maiores;
- gravação automática e recuperação;
- exportação/importação JSON;
- WebApp instalável e utilização offline após a primeira visita.

## Motor estrutural

Unidades da interface:

- geometria: m;
- forças: kN;
- momentos: kNm;
- cargas distribuídas: kN/m.

Internamente o MEF trabalha em **N-mm**, coerente com `E` em MPa, `A` em mm² e `I` em mm⁴. O motor suporta elementos de pórtico plano 2D, barras de treliça axiais, ações nodais e múltiplas ações de barra.

## Betão Armado / EC2

Mantém os módulos desenvolvidos para flexão, armaduras mínimas/máximas, corte, estribos, fissuração, deformações, tensões de serviço, durabilidade, recobrimento, espaçamentos, ancoragens, emendas, pilares, lajes, punçoamento, sapatas, fadiga simplificada, pré-verificação de incêndio, desenho esquemático e mapa estimado de armaduras.

Consultar `EC2_COVERAGE.md` para cobertura e limitações. Os módulos assinalados como pré-verificação/triagem não substituem uma verificação normativa integral.

## Build local

Requer Node >= 22.12 e < 25.

```bash
npm install --no-audit --no-fund
npm run build
```

## Android / GitHub Actions

O workflow usa Node 24, Java 21 e Capacitor 7. Gera os ícones, aplica a correção do `ic_launcher_background`, executa `assembleDebug` e publica o APK.

Artefacto esperado: **`RJP-Structures-V1.7.5-debug-apk`**.

## WebApp / GitHub Pages

O workflow `WebApp GitHub Pages` compila e publica a pasta `dist`. Em **Settings → Pages**, selecionar **GitHub Actions** como origem.

Artefacto esperado: **`RJP-Structures-V1.7.5-WebApp`**.

## Ficheiros principais

- `src/App.tsx` — interface, editor e integração MEF/EC2;
- `src/structural.ts` — motor MEF 2D e ações múltiplas de barra;
- `src/ec2.ts` — motor EC2;
- `src/styles.css` — interface gráfica e acessibilidade;
- `.github/workflows/android.yml` — build Android;
- `.github/workflows/webapp.yml` — build/publicação WebApp;
- `CHANGELOG_V1_7_5.md` — alterações desta versão;
- `VALIDATION_V1_7_5.md` — validações efetuadas;
- `EC2_COVERAGE.md` — matriz de cobertura normativa.
