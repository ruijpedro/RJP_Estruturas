# RJP Structures V1.7.9 — Painel de propriedades editável

## Editor contextual à direita

- Quatro áreas próprias: **Elemento**, **Ações**, **Nós e apoios** e **Materiais**.
- Seleção da barra por toque no desenho ou por lista, com propriedades por elemento.
- Alteração de comprimento, secção retangular, recobrimento e ligações rígida/rótula por extremo.
- Ao editar o comprimento, move-se o nó final e as posições das ações da barra são ajustadas proporcionalmente.
- As alterações de geometria, secção e material de uma barra deixam de ser substituídas por valores globais ao recalcular o modelo.
- Edição direta e cumulativa de forças concentradas, uniformes, triangulares, trapezoidais e momentos; cada ação tem tipo, posição e intensidade próprios.
- Em **Selecionar**, tocar numa ação abre a sua edição no painel, em vez de exigir a caixa modal.
- Seleção do nó por toque no desenho ou lista; edição X/Y, tipo de apoio (livre, móvel X/Y, articulado, encastrado), Fx, Fy e Mz.
- Remoção individual de ações e apoios, ou limpeza de todas as ações e apoios com confirmação.
- Campos numéricos aceitam vírgula decimal; aplicam a alteração ao sair do campo ou ao premir Enter, sem saltarem de valor a cada tecla.
- Os novos dados são incluídos nos modelos guardados, cópia automática e exportação JSON.

## Mantido

Editor livre, barras rígidas por defeito, rótulas opcionais, múltiplas ações, MEF 2D, EC2, PT-PT, WebApp/PWA e workflow Android.

## Limites de validação

A implementação do painel não equivale à validação profissional do EC2; continuam aplicáveis os limites documentados em `EC2_COVERAGE.md`.
