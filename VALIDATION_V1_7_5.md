# Validação — RJP Structures V1.7.5

## Motor MEF

Foram executados testes independentes ao módulo `structural.ts`:

- viga simplesmente apoiada, L=6 m, q=10 kN/m: reações 30/30 kN e |M|max=45 kNm;
- viga simplesmente apoiada, L=6 m, P=20 kN a meio vão: reações 10/10 kN e |M|max=30 kNm;
- carga triangular 0→12 kN/m em 6 m: reações 12/24 kN, totalizando 36 kN;
- momento concentrado de 12 kNm a meio vão: reações +2/-2 kN e |M|max=6 kNm;
- `src/structural.ts` validado com TypeScript em modo `strict`.

## Interface

Foi efetuada verificação TypeScript da aplicação com stubs React locais para detetar erros de sintaxe/tipos internos. O `npm install` completo não concluiu neste ambiente por timeout de acesso ao registry; a validação final Vite/Capacitor deve ser confirmada pelo GitHub Actions.

## Limites

Ações de barra em treliças ficam limitadas a forças axiais concentradas. Para ações transversais em treliças, usar cargas nodais.
