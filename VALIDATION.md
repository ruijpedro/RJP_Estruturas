# Validação rápida — RJP Structures V1.6

## 1. Viga simplesmente apoiada

Dados:

- vão: 6,00 m;
- carga uniforme: 10 kN/m;
- apoios simples.

Solução analítica e resultado do motor:

- R1 = 30,00 kN;
- R2 = 30,00 kN;
- Vmax = 30,00 kN;
- Mmax = 45,00 kNm.

## 2. Treliça simétrica

Dados:

- vão: 6,00 m;
- altura: 3,00 m;
- carga vertical no nó superior: 20 kN;
- apoio articulado à esquerda e móvel à direita.

Resultado do motor:

- reação vertical esquerda = 10,00 kN;
- reação vertical direita = 10,00 kN.

Confirma-se que o elemento `truss` trabalha axialmente.

## 3. Ensaio EC2 de sanidade

Viga retangular:

- b = 300 mm;
- h = 500 mm;
- C30;
- aço 500 MPa;
- MEd = 100 kNm;
- VEd = 80 kN.

O motor devolveu, no teste local:

- d = 449 mm;
- As,req ≈ 539,9 mm²;
- VRd,c ≈ 61,75 kN;
- 17 verificações/estados no resultado agregado.

Este ensaio é de coerência numérica, não substitui validação normativa independente.

## 4. TypeScript

O código V1.6 foi verificado em modo `strict` e `isolatedModules` com TypeScript 5.8.3, usando declarações locais mínimas apenas para substituir React no ambiente offline. Não foram encontrados erros de tipagem no código `App.tsx`, `structural.ts` e `ec2.ts`.

O ambiente de geração não teve resolução DNS para o registry npm, pelo que a instalação completa de dependências/Vite não pôde ser repetida localmente. O workflow GitHub incluído faz `npm install` antes do build.

## Nota de engenharia

Estes benchmarks verificam o núcleo para casos básicos. Para uso profissional, validar adicionalmente pórticos multi-vão/piso, combinações de ações, condições de apoio, deslocamentos, estabilidade e cada módulo EC2 contra cálculos independentes e o Anexo Nacional aplicável.
