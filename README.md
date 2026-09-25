# RJP Structures V1.7.7

## Novidades da V1.7.7

Esta versão corrige a distinção entre **nó**, **apoio** e **rótula**.

- Uma barra de viga/pórtico é criada com **ligação rígida no início e no fim**.
- Os nós MEF continuam a existir para o cálculo, mas são desenhados como pequenos pontos sólidos e **não representam rótulas**.
- Uma rótula só existe quando é ativada em **Modelo → Ligações da barra**.
- Cada extremidade pode ser configurada independentemente como **Rígida** ou **Rótula**.
- As rótulas reais aparecem no desenho como um círculo branco marcado `R`.
- O motor MEF trata as libertações rotacionais por condensação estática.
- Numa viga contínua, barras que partilham um nó transmitem momento enquanto as ligações forem rígidas.
- Projetos antigos sem informação de libertações são interpretados como ligações rígidas.
- Mantêm-se o editor gráfico fluido, ações múltiplas, apoios editáveis, MEF 2D, EC2, Pormenorização, WebApp/PWA e APK Android.

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

Artefacto esperado: **`RJP-Structures-V1.7.7-debug-apk`**.

## WebApp / GitHub Pages

O workflow `WebApp GitHub Pages` compila e publica a pasta `dist`. Em **Settings → Pages**, selecionar **GitHub Actions** como origem.

Artefacto esperado: **`RJP-Structures-V1.7.7-WebApp`**.

## Ficheiros principais

- `src/App.tsx` — interface, editor e integração MEF/EC2;
- `src/structural.ts` — motor MEF 2D e ações múltiplas de barra;
- `src/ec2.ts` — motor EC2;
- `src/styles.css` — interface gráfica e acessibilidade;
- `.github/workflows/android.yml` — build Android;
- `.github/workflows/webapp.yml` — build/publicação WebApp;
- `CHANGELOG_V1_7_7.md` — alterações desta versão;
- `VALIDATION_V1_7_7.md` — validações efetuadas;
- `EC2_COVERAGE.md` — matriz de cobertura normativa.
