# RJP Structures V1.7.1

Aplicação Web/Android (React + Vite + Capacitor) para **Vigas + Pórticos 2D + Treliças 2D**, com motor MEF, dimensionamento modular em **Betão Armado segundo EC2**, seleção automática de armaduras e pormenorização esquemática. Toda a interface utiliza **Português de Portugal**.

## Novidades da V1.7

A V1.7 concentra-se em três áreas: **acessibilidade**, **segurança do projeto** e **edição gráfica mais direta**.

### Acessibilidade

- tamanho do texto da interface: 90%, 100%, 115%, 130% ou 145%;
- tamanho independente dos rótulos do desenho técnico: 90% a 130%;
- contraste reforçado;
- botões e áreas de toque maiores para tablet;
- preferências guardadas automaticamente.

### Gravação automática e recuperação

- snapshot completo do projeto após alterações;
- indicação da hora da última gravação automática;
- recuperação manual da última cópia automática;
- exportação/importação JSON continua disponível;
- o JSON V1.7 pode incluir também preferências de interface e data de gravação.

### Editor gráfico V1.7

- **Selecionar**: seleção direta de barras;
- **Apoio**: tocar num nó alterna entre Livre → Móvel → Articulado → Encastrado;
- símbolos gráficos diferenciados para os tipos de apoio;
- **Carga**: tocar num nó permite editar `Fx`, `Fy` e `Mz`;
- **Carga**: tocar numa barra permite editar `qy` em kN/m;
- **Apagar**: elimina forças nodais, cargas distribuídas ou apoios diretamente no modelo;
- o MEF é recalculado imediatamente após cada alteração;
- **Repor ações e apoios do modelo** restaura o modelo paramétrico inicial.

As ferramentas **Nó / Barra / Mover** permanecem na barra para a evolução do editor livre; nesta versão ainda não criam ou deslocam geometria arbitrária.

## Interface gráfica

Mantém o mockup aprovado:

- cabeçalho vermelho RJP com **Novo / Abrir / Guardar / Calcular / Relatório**;
- barra lateral de ferramentas;
- área de desenho com grelha técnica, eixos, cargas e apoios;
- zoom 70%–200%;
- **Grelha / Rótulos / Ações** configuráveis;
- modo **Foco**;
- painel de propriedades recolhível;
- **Desfazer / Refazer** das alterações paramétricas;
- nome do projeto editável;
- visualização de **N / V / M / Deformada** sobre o modelo;
- quadro rápido de resultados;
- navegação **Modelo / Cargas / Resultados / EC2 / Pormenorização / Relatório / Definições**.

## Motor estrutural

Unidades da interface:

- geometria: m;
- forças: kN;
- momentos: kNm;
- cargas distribuídas: kN/m.

Internamente o MEF trabalha em **N-mm**, coerente com `E` em MPa, `A` em mm² e `I` em mm⁴.

O motor suporta elementos de pórtico plano 2D, elementos de treliça axiais, cargas nodais `Fx/Fy/Mz`, carga distribuída local `qy`, reações, deslocamentos, deformada, diagramas N/V/M e valores críticos ao longo da barra.

## Betão Armado / EC2

Mantém os módulos já implementados para:

- propriedades de betão e aço e resistências de cálculo;
- flexão, `As,req`, `As,min`, `As,max`, `MRd`;
- armaduras inferior/superior;
- corte `VRd,c`, `VRd,s`, `VRd,max`;
- estribos e zonas de apoio/vão;
- torção/interação V+T;
- fissuração e deformações;
- tensões de serviço;
- durabilidade e recobrimento;
- espaçamentos, ancoragens e emendas;
- pilares, lajes, punçoamento e sapatas;
- fadiga simplificada e pré-verificação de incêndio;
- desenho esquemático e mapa estimado de armaduras.

Consulte `EC2_COVERAGE.md` para a cobertura e limitações do motor. Os módulos identificados como pré-verificação/triagem não substituem uma verificação normativa integral.

## Build local

Requer Node >= 22.12 e < 25.

```bash
npm install --no-audit --no-fund
npm run build
```

## Android / GitHub Actions

O workflow incluído usa Node 24, Java 21 e Capacitor 7, gera os ícones, aplica a correção do `ic_launcher_background`, executa `assembleDebug` e publica o APK.

Artefacto esperado: `RJP-Structures-V1.7.1-debug-apk`.

## Ficheiros principais

- `src/App.tsx` — interface + integração MEF/EC2;
- `src/structural.ts` — motor MEF 2D;
- `src/ec2.ts` — motor EC2;
- `src/styles.css` — interface gráfica e acessibilidade;
- `.github/workflows/android.yml` — build Android;
- `CHANGELOG_V1_7.md` — alterações desta versão;
- `VALIDATION_V1_7.md` — validação desta versão;
- `EC2_COVERAGE.md` — matriz de cobertura normativa.


## WebApp / PWA

A V1.7.1 pode ser distribuída simultaneamente como APK Android e WebApp instalável. A WebApp inclui `manifest.webmanifest`, service worker para utilização offline após a primeira visita e workflow `.github/workflows/webapp.yml` para publicação automática no GitHub Pages.

### Publicar no GitHub Pages
1. Enviar esta versão para o repositório.
2. Abrir **Settings → Pages** no GitHub e escolher **GitHub Actions** como origem.
3. Executar o workflow **WebApp GitHub Pages** (ou fazer push para `main`/`master`).
4. No fim do workflow, o endereço da WebApp aparece no deployment `github-pages`.

A aplicação guarda projetos e preferências no armazenamento local do navegador. Continua disponível a exportação/importação JSON para cópias de segurança e transferência entre dispositivos.
