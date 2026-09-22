# RJP Structures V1.6.0

Aplicação Web/Android (React + Vite + Capacitor) para **Vigas + Pórticos 2D + Treliças 2D**, com motor MEF, interface totalmente em **Português de Portugal**, dimensionamento modular de **Betão Armado segundo EC2** e pormenorização esquemática.

## V1.6 — editor estrutural interativo

A V1.6 transforma a área gráfica num editor utilizável diretamente sobre a grelha:

- **Nó** — toque na grelha para criar um novo nó;
- **Barra** — toque em dois nós para criar uma barra;
- **Apoio** — toque num nó para alternar entre articulado, móvel, encastre e livre;
- **Carga** — toque num nó para acrescentar uma carga vertical ou numa barra para acrescentar uma carga distribuída;
- **Mover** — arraste um nó; a posição é ajustada ao snap definido;
- **Apagar** — toque numa barra ou nó para remover;
- **Selecionar** — seleção direta de nós e barras para edição numérica no painel lateral.

O painel de propriedades permite editar:

- coordenadas X/Y dos nós;
- tipo de apoio;
- Fx, Fy e Mz nodais;
- E e A das barras;
- largura, altura e recobrimento das peças de betão;
- carga distribuída local q;
- snap da grelha.

O cálculo MEF é atualizado automaticamente após cada alteração válida do modelo.

## Interface V1.6

Mantém o mockup aprovado:

- cabeçalho RJP com **Novo / Abrir / Guardar / Calcular / Relatório**;
- barra lateral de ferramentas;
- grande área de desenho com grelha técnica;
- resultados **N / V / M / Deformada** sobre o modelo;
- quadro rápido de resultados;
- painel de propriedades contextual;
- navegação inferior **Modelo / Cargas / Resultados / EC2 / Pormenorização / Relatório / Definições**;
- layout adaptado a PC e tablet.

## Motor estrutural

Unidades da interface:

- geometria: m;
- forças: kN;
- momentos: kNm;
- cargas distribuídas: kN/m.

Internamente o MEF trabalha em **N-mm**, coerente com `E` em MPa, `A` em mm² e `I` em mm⁴.

Suporta:

- elementos de pórtico plano 2D;
- barras de treliça exclusivamente axiais;
- cargas nodais `Fx`, `Fy`, `Mz`;
- carga distribuída local `qy` em elementos de pórtico;
- reações;
- deslocamentos;
- deformada;
- diagramas N/V/M;
- valores críticos ao longo das barras.

## Betão Armado / EC2

Mantém os módulos existentes:

- propriedades do betão e aço;
- flexão e armadura longitudinal;
- `As,req`, `As,min`, `As,max`, `MRd`;
- momentos positivos/negativos;
- corte `VRd,c`, `VRd,s`, `VRd,max`;
- seleção de estribos;
- torção/interação;
- fissuração;
- deformações;
- tensões de serviço;
- durabilidade e recobrimento;
- espaçamentos, ancoragens e emendas;
- pilares: esbelteza, 2.ª ordem, armadura e interação N-M de triagem;
- lajes por faixa de 1 m;
- punçoamento;
- sapatas;
- fadiga simplificada;
- pré-verificação de incêndio;
- desenhos esquemáticos e mapa estimado de armaduras.

Ver `EC2_COVERAGE.md` para a matriz de cobertura e limitações.

## Projeto e ficheiros

A V1.6 guarda também a **geometria editada** no projeto JSON:

- modo;
- definições;
- nós;
- barras;
- apoios;
- cargas;
- secções;
- snap da grelha.

## Build local

Requer Node >= 22.12 e < 25.

```bash
npm install --no-audit --no-fund
npm run build
```

## Android / GitHub Actions

O workflow incluído usa:

```text
Node 24
→ npm install
→ TypeScript + Vite
→ Capacitor Android
→ geração dos ícones
→ Gradle assembleDebug
→ upload do APK
```

Artefacto: `RJP-Structures-V1.6.0-debug-apk`.

## Ficheiros principais

- `src/App.tsx` — interface, editor gráfico e integração MEF/EC2;
- `src/structural.ts` — motor MEF 2D;
- `src/ec2.ts` — motor EC2;
- `src/styles.css` — interface gráfica;
- `.github/workflows/android.yml` — build Android;
- `VALIDATION.md` — testes básicos;
- `EC2_COVERAGE.md` — cobertura normativa.
