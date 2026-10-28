# Validação V1.7.2

## Novo modelo
Foram revistos os seis modos de arranque disponíveis no assistente **Novo modelo**:

- Modelo padrão
- Em branco
- Apoios
- Barra sem nós visíveis
- Barra com nós
- Nós

## Regras internas
- Uma barra continua a ser representada internamente por dois nós, como exige o MEF.
- Na opção **Barra sem nós visíveis**, os nós são apenas ocultados no desenho.
- A ferramenta **Nós** da barra de visualização permite mostrar/ocultar os nós a qualquer momento.
- A ferramenta **Apoio** cria um nó de apoio quando é usada numa zona vazia.
- A ferramenta **Barra** cria automaticamente os nós extremos quando não existem nós próximos.
- A ferramenta **Nó** cria nós independentes na grelha.
- Coordenadas criadas graficamente usam snap de 0,25 m.

## Persistência
Modelos livres, visibilidade dos nós e opções de projeto são incluídos no autosave e na exportação JSON.

## Verificação TypeScript
Foi efetuada verificação sintática/tipológica dos módulos principais com TypeScript. No ambiente local de geração não estavam disponíveis as dependências React do projeto, pelo que foram usadas declarações de interface temporárias apenas para validar a estrutura TypeScript/JSX; não foram detetados erros adicionais no código introduzido.
