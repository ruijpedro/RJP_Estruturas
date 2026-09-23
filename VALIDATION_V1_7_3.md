# Validação V1.7.3 — cargas em barras

Ensaios numéricos efetuados diretamente ao motor `structural.ts`, para uma viga biarticulada de 6,00 m.

| Caso | Resultado obtido | Referência analítica |
|---|---:|---:|
| P = 10 kN ao meio vão | RA = RB = 5,00 kN; Mmax = 15,00 kNm | P/2; PL/4 |
| q = 10 kN/m em 6 m | RA = RB = 30,00 kN; Mmax = 45,00 kNm | qL/2; qL²/8 |
| triangular 0 → 10 kN/m | RA = 10,00 kN; RB = 20,00 kN | carga total 30 kN, resultante a 4 m |
| M = 12 kNm ao meio vão | RA = +2,00 kN; RB = -2,00 kN; |M|max = 6,00 kNm | M/L = 2 kN |
| q parcial = 8 kN/m entre 1 e 5 m | RA = RB = 16,00 kN; Mmax = 32,00 kNm | simetria e equilíbrio |

Também foi efetuada verificação sintática e de tipos do código da aplicação com TypeScript 5.8, usando declarações locais mínimas para React devido à indisponibilidade das dependências npm no ambiente de geração. O ficheiro `structural.ts` foi compilado diretamente em modo `strict`.

A validação de projeto continua a exigir confirmação independente das hipóteses, unidades, combinações e regras normativas aplicáveis.
