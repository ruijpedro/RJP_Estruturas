# Validação V1.7.2

## Verificação do solver de rótulas

Foi compilado `src/structural.ts` isoladamente com TypeScript em modo `strict` e testada uma barra de 6,00 m, q = 10 kN/m.

### Encastrada nas duas extremidades
- reações verticais: 30 + 30 kN;
- momentos de extremidade em módulo: 30 kNm;
- momento a meio vão: 15 kNm.

### Rótula nas duas extremidades
- reações verticais: 30 + 30 kN;
- momentos nas rótulas: aproximadamente 0 kNm;
- momento máximo no vão: 45 kNm.

### Rótula inicial + extremo final rígido
- reações verticais: 22,5 + 37,5 kN;
- momento no extremo libertado: 0 kNm;
- momento no extremo rígido: 45 kNm em módulo.

Os valores coincidem com as soluções analíticas clássicas para estes casos.

## Verificação TypeScript

`App.tsx`, `structural.ts` e `ec2.ts` foram verificados com TypeScript `strict` usando declarações temporárias apenas para substituir os pacotes React indisponíveis no ambiente de validação. Não foram detetados erros de tipos no código da versão.

A instalação completa de dependências npm não foi concluída no ambiente de preparação por timeout de acesso ao registry; o build completo deve ser confirmado pelo GitHub Actions incluído no projeto.
