# RJP Structures V1.8.3

- Pan com um dedo ao arrastar uma zona vazia do canvas em **Selecionar** ou **Mover**.
- Pan por rato ao arrastar o fundo do canvas.
- Elementos continuam com Grab & Drag prioritário: apoio, nó ou carga arrastam o próprio elemento, não o canvas.
- Ao entrar um segundo dedo, o pan de um dedo é cancelado e passa para pan + pinch de dois dedos.
- Service Worker alterado para navegação network-first, evitando index/JS antigos após novo deploy no GitHub Pages.
- Registo do Service Worker força verificação de atualização sem cache.
