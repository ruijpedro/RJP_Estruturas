# Verificações efetuadas — V1.8.2

- Verificada a remoção da gestão multitoque duplicada por Pointer Events.
- O canvas usa listener nativo `touchmove` com `passive: false`, permitindo `preventDefault()`.
- Pinch e pan usam o mesmo ponto de ancoragem no viewBox, evitando saltos do desenho.
- A navegação multitoque não altera o modelo estrutural nem cria nós/barras.
- Mantidos os eventos Pointer para seleção, Grab & Drag e edição com um dedo/rato.
