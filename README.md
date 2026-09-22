# RJP Structures V1.5.1

Aplicação Web/Android (React + Vite + Capacitor) para **Vigas + Pórticos 2D + Treliças 2D**, com motor MEF, dimensionamento modular em **Betão Armado segundo EC2**, seleção automática de armaduras e pormenorização esquemática.

## V1.5 — nova interface gráfica

A V1.5 aplica o mockup aprovado à aplicação e uniformiza a linguagem para **Português de Portugal**.

Principais alterações:

- cabeçalho vermelho RJP com **Novo / Abrir / Guardar / Calcular / Relatório**;
- barra lateral de ferramentas com **Selecionar / Nó / Barra / Apoio / Carga / Mover / Apagar**;
- área de desenho maior, com grelha técnica, eixos, cargas e apoios;
- seleção direta das barras no desenho;
- visualização sobre o modelo de **N / V / M / Deformada**;
- quadro rápido de resultados sob o modelo;
- painel direito de propriedades e dimensionamento;
- navegação inferior: **Modelo / Cargas / Resultados / EC2 / Pormenorização / Relatório / Definições**;
- termos técnicos revistos para PT-PT: **betão, varões, estribos, recobrimento, esforço transverso, pormenorização, cumpre / não cumpre**, etc.;
- interface responsiva para PC e tablet;
- manutenção dos módulos de vigas, pórticos e treliças e do motor EC2 existente.

> A barra gráfica de ferramentas já está integrada na V1.5. A edição geométrica continua essencialmente paramétrica nesta versão; o passo seguinte é transformar Nó/Barra/Apoio/Carga/Mover/Apagar num editor livre completo sobre o desenho.

## Motor estrutural

Unidades da interface:

- geometria: m;
- forças: kN;
- momentos: kNm;
- cargas distribuídas: kN/m.

Internamente o MEF trabalha em **N-mm**, coerente com `E` em MPa, `A` em mm² e `I` em mm⁴.

O motor suporta:

- elementos de pórtico plano 2D;
- elementos de treliça exclusivamente axiais;
- cargas nodais `Fx`, `Fy`, `Mz`;
- carga distribuída local `qy` em elementos de pórtico;
- reações;
- deslocamentos;
- deformada;
- diagramas N/V/M;
- valores críticos amostrados ao longo da barra.

## Betão Armado / EC2

Inclui atualmente:

- propriedades do betão e do aço;
- resistências de cálculo;
- flexão simples em vigas/lajes;
- `As,req`, `As,min`, `As,max`, `MRd`;
- momentos positivos/negativos e armaduras inferior/superior;
- corte `VRd,c`, `VRd,s`, `VRd,max`;
- seleção automática de estribos e zonas de apoio/vão;
- torção e interação V+T em secções retangulares;
- fissuração `wk`;
- deformações por rigidez efetiva + fluência;
- tensões de serviço no betão e no aço;
- durabilidade/recobrimento X0/XC/XD/XS;
- espaçamentos, ancoragens e emendas;
- pilares: armadura mínima/máxima, esbelteza, 2.ª ordem, cintas e interação N-M de triagem;
- lajes por faixa de 1 m;
- punçoamento;
- sapatas;
- fadiga simplificada;
- pré-verificação de incêndio;
- desenho esquemático e mapa estimado de armaduras.

Casos especializados continuam identificados no ficheiro `EC2_COVERAGE.md` e não devem ser interpretados como verificação normativa integral quando o motor os marca como pré-verificação/triagem.

## Build local

Requer Node >= 22.12 e < 25.

```bash
npm install --no-audit --no-fund
npm run build
```

## Android / GitHub Actions

O workflow incluído executa:

```text
Node 24
→ npm install
→ TypeScript + Vite
→ Capacitor Android
→ geração dos ícones
→ Gradle assembleDebug
→ upload do APK
```

O artefacto chama-se `RJP-Structures-V1.5.1-debug-apk`.

## Ficheiros principais

- `src/App.tsx` — interface + integração MEF/EC2;
- `src/structural.ts` — motor MEF 2D;
- `src/ec2.ts` — motor de dimensionamento/verificações;
- `src/styles.css` — interface gráfica V1.5;
- `.github/workflows/android.yml` — build Android;
- `VALIDATION.md` — benchmarks básicos;
- `EC2_COVERAGE.md` — matriz de cobertura normativa.


## Correção V1.5.1 — ícone adaptativo Android

Foi corrigida a falha de compilação AAPT causada pela ausência do recurso `ic_launcher_background`.
A versão inclui `assets/icon-background.png` e uma salvaguarda no workflow que cria o recurso de cor e atualiza os XML dos ícones adaptativos antes do Gradle.
