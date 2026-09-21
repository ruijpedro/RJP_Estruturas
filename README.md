# RJP Structures V1.1.0

Aplicação Web/Android (React + Vite + Capacitor) para análise estrutural 2D e dimensionamento de betão armado.

## Correção do GitHub Actions

O erro `Dependencies lock file is not found` vinha de `cache: npm` no `actions/setup-node`. Nesta revisão o workflow deixa de exigir lock file/cache e instala com `npm install --no-audit --no-fund`. Mantém Node 22.23.2 e Java 21.

## EC2 implementado nesta revisão

O motor EC2 modular está em `src/ec2.ts` e cobre o núcleo usado em estruturas correntes de betão armado e na metodologia IPL:

- materiais: `fcd`, `fyd`, `fctm`, `fctd`, `Ecm`, bloco retangular, `nu1`;
- vigas: flexão, `As,req`, `As,min`, `As,max`, capacidade `MRd`, seleção automática de varões;
- corte: `VRd,c`, `VRd,max`, `VRd,s`, `Asw/s` e armadura transversal mínima;
- torção: modelo equivalente e interação V+T;
- ELS: fissuração `wk` e deformação estimada com rigidez efetiva/fluência;
- durabilidade: X0/XC/XD/XS, `cmin,dur`, `cmin` e `cnom`;
- pormenorização: espaçamento entre varões, estribos, ancoragem `lb,rqd / lbd` e sobreposição `l0`;
- pilares: `M0e`, `M0,min`, esbelteza, `lambda_lim`, efeitos de 2.ª ordem por curvatura nominal, `As,min/max` e resistência axial de referência;
- flexão biaxial: função de interação disponível no motor;
- lajes: faixa de 1 m, flexão, corte, fissuração, deformação e espaçamento;
- punçoamento: perímetro `u1`, `vEd`, `vRd,c`, `vRd,max` e indicação da necessidade de armadura;
- sapatas: pressão, flexão nas duas direções e ligação ao módulo de punçoamento;
- fadiga: pré-verificação por amplitude de tensão;
- incêndio: pré-verificação conservadora R30/R60/R90/R120; a confirmação final continua dependente da EN 1992-1-2 e do caso real;
- desenhos SVG esquemáticos de vigas/pilares e relatório imprimível/PDF.

## Perfil IPL

A base usa os parâmetros que foram usados na metodologia do projeto RJP/Betão Armado:

- `alphaCC = 0.85` por defeito;
- `gammaC = 1.5`;
- `gammaS = 1.15`;
- `cot(theta) = 1` por defeito;
- apresentação explícita de `MEd`, `VEd`, `As`, `VRd`, `wk`, deformação, ancoragens e verificações.

O motor permite alterar os parâmetros para outro perfil/Anexo Nacional.

## Limite de âmbito

A V1.1 cobre de forma ampla o dimensionamento corrente de betão armado em edifícios. O EC2 normativo completo contém situações especializadas que precisam de informação adicional (por exemplo pré-esforço, betão leve, interfaces, modelos específicos de escoras e tirantes, fadiga avançada, incêndio termo-mecânico e regras particulares de anexos nacionais). Esses casos ficam isolados por módulos para não serem apresentados como verificados sem os dados necessários.

## Build local

```bash
npm install --no-audit --no-fund
npm run build
```

## Android

```bash
npm install --no-audit --no-fund
npm run build
npx cap add android   # apenas se android/ ainda não existir
npx cap sync android
cd android
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`
