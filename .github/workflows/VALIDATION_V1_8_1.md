# Verificações efetuadas — V1.8.1

- Revisão do fluxo de seleção/edição no painel Propriedades.
- Seleção de apoio/carga/nó antes do início do Grab & Drag.
- Pan/zoom multitoque implementado com Pointer Events e `touch-action: none` apenas na área gráfica.
- `Ajustar` repõe zoom e pan.
- Atualização da versão, cache PWA e nomes dos artefactos dos workflows para V1.8.1.
- Validação sintática TypeScript/TSX executada localmente; build completo depende das dependências npm do workflow.
- `src/App.tsx`, `src/main.tsx`, `src/structural.ts` e `src/ec2.ts`: parsing/transpilação TypeScript sem erros sintáticos.
- `npm install` local não concluiu dentro do limite do ambiente; o workflow GitHub permanece como validação integral de dependências/build.
