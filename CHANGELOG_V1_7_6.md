# RJP Structures V1.7.7 — Editor gráfico fluido

## Correção principal
A V1.7.7 substitui a interação baseada em cliques/prompts por um editor gráfico orientado a toque/pointer.

### Desenho de barras
- Ferramenta **Barra**: primeiro toque define o início, segundo toque define o fim.
- Pré-visualização azul da barra enquanto se escolhe o segundo ponto.
- Os nós extremos são criados automaticamente quando não existem.
- Se o toque coincidir com um nó existente, a barra liga a esse nó.
- O primeiro toque já não cria um nó isolado, evitando estados intermédios instáveis.

### Apoios
- Ferramenta **Apoio** em ponto vazio: cria nó + apoio.
- Ferramenta **Apoio** num nó: abre seletor visual.
- Tipos: Livre, Móvel Y, Móvel X, Articulado e Encastrado.
- Em **Apagar**, tocar no símbolo do apoio remove apenas o apoio.

### Cargas e momentos
- Ferramenta **Carga** num nó: editor visual de Fx, Fy e Mz.
- Ferramenta **Carga** numa barra: editor visual com:
  - força concentrada transversal;
  - força concentrada axial;
  - carga distribuída uniforme;
  - carga triangular;
  - carga trapezoidal;
  - momento aplicado.
- Posição x e troços x1/x2 editáveis.
- Várias ações simultâneas na mesma barra.
- As ações podem ser reeditadas tocando diretamente no respetivo símbolo.

### Edição geométrica
- Ferramenta **Mover**: arrastar nós diretamente.
- Ferramenta **Apagar**: elimina barras e nós; ao eliminar um nó são eliminadas as barras ligadas.
- Janela gráfica de referência estabilizada para reduzir saltos durante o arrasto.
- Área de toque das barras aumentada, importante para tablet e telemóvel.

### WebApp/PWA
- cache atualizado para `rjp-structures-v1.7.7`, forçando a substituição da interface antiga após atualização.
- mantém publicação GitHub Pages e APK Android no mesmo repositório.
