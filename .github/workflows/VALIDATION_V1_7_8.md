# Validação V1.7.8

## Verificações efetuadas

1. Barras de viga/pórtico continuam a ser criadas com `releaseStartR=false` e `releaseEndR=false`.
2. O apoio é guardado no nó através de `fixX`, `fixY` e `fixR`; não altera as libertações da barra.
3. O símbolo de apoio articulado/móvel tem o vértice coincidente com o nó/extremo da barra.
4. Nos nós com apoio não é desenhado o marcador circular de nó, mesmo quando a visualização dos nós MEF está ativa.
5. Nos nós livres, a visualização técnica usa um pequeno quadrado, distinguindo-o da rótula explícita.
6. A rótula explícita mantém círculo branco/vermelho e letra R, permitindo distinguir inequivocamente apoio, nó e libertação de barra.
7. A visualização **Nós MEF** fica desligada por defeito numa instalação V1.7.8 e nos modelos Padrão/Apoios.
8. O cache PWA foi incrementado para `rjp-structures-v1.7.8`.

## TypeScript

Foi feita uma verificação sintática com o compilador TypeScript disponível no ambiente. A verificação completa do projeto depende das dependências React/Vite; a instalação npm neste ambiente excedeu o tempo disponível. O workflow GitHub Actions continua a executar `npm install`/build no ambiente do repositório.
