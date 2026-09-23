# RJP Structures V1.7.2

## Editor livre
- Novo projeto em branco no tipo de modelo selecionado.
- Criação de nós por toque/clique na grelha, com snap de 0,25 m.
- Criação de barras selecionando nó inicial e nó final.
- Movimento de nós por coordenadas.
- Eliminação direta de barras e nós.
- Confirmação antes de apagar um nó com barras ligadas.
- Geometria livre guardada no autosave e no JSON do projeto.

## Rótulas
- Nova ferramenta **Rótula**.
- Libertação de rotação independente na extremidade inicial/final de barras frame.
- Inserir/remover rótula graficamente e no painel de propriedades.
- Símbolo de rótula representado no modelo.
- Condensação estática incorporada no solver MEF.

## Solver
- Grau de liberdade rotacional automaticamente eliminado quando todas as barras ligadas ao nó estão libertadas nesse extremo.
- Modelos totalmente restringidos deixam de falhar apenas por não possuírem graus de liberdade livres.
- Correção do cálculo de V(x) e M(x) a partir dos esforços de extremidade e de q.

## Distribuição
- Versão da app e PWA atualizada para 1.7.2.
- Artefactos GitHub Actions atualizados para V1.7.2.
