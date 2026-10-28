# RJP Structures V1.7.7

## Ligações de barras e rótulas

- As barras de viga/pórtico são agora explicitamente **rígidas nos dois extremos por defeito**.
- Um **nó MEF deixou de ser desenhado como um círculo aberto**, para não ser confundido com uma rótula.
- As rótulas passam a ser libertações rotacionais opcionais por barra: início e/ou fim.
- A rótula é representada graficamente apenas quando ativada, por um círculo branco marcado `R`.
- O painel **Modelo > Ligações da barra** permite alternar cada extremidade entre `Rígida` e `Rótula`.
- O motor MEF passou a tratar as libertações rotacionais por condensação estática, mantendo continuidade de momentos nas ligações rígidas.
- Projetos antigos sem propriedades de libertação são interpretados como ligações rígidas.

## Editor

- `Barra rígida sem nós visíveis` e `Barra rígida com nós` deixam explícito que nós e rótulas são conceitos diferentes.
- Barras criadas diretamente na grelha ficam rígidas por defeito.
