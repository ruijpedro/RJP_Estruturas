# Validação rápida — RJP Structures V1.6

## Benchmark 1 — viga simplesmente apoiada

Dados:

- vão: 6,00 m
- carga uniforme: 10 kN/m
- apoios simples

Solução analítica:

- R1 = 30,00 kN
- R2 = 30,00 kN
- Vmax = 30,00 kN
- Mmax = 45,00 kNm

Resultado do motor V1.6:

- R1 = 30,00 kN
- R2 = 30,00 kN
- Vmax = 30,00 kN
- Mmax = 45,00 kNm

## Benchmark 2 — treliça simétrica

Geometria:

- vão 6,00 m
- altura 3,00 m
- carga vertical no nó superior: 20 kN
- apoio articulado à esquerda e móvel à direita

Resultado do motor:

- reação vertical esquerda = 10,00 kN
- reação vertical direita = 10,00 kN
- diagonais superiores ≈ -14,142 kN (compressão)
- cordas inferiores ≈ +10,00 kN (tração)
- montante central ≈ 0 kN para este caso simétrico

Este teste confirma que o novo elemento `truss` trabalha apenas axialmente.

## Teste de TypeScript

A V1.6 foi verificada com `tsc --strict` usando declarações locais mínimas de React para validar a sintaxe e a tipagem do código da aplicação sem depender do download de pacotes.

## Nota

Os benchmarks acima validam o núcleo MEF para casos simples. Uso profissional exige uma bateria alargada de ensaios para combinações de cargas, pórticos multi-vão/piso, deslocamentos, pilares e cada verificação EC2.
