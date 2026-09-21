# RJP Structures — Matriz EC2 V1.1

| Módulo | Estado | Observação |
|---|---|---|
| Materiais / resistências de cálculo | Implementado | alphaCC e gammas parametrizáveis |
| Flexão simples em vigas/lajes | Implementado | bloco retangular + seleção de armaduras |
| Flexão composta / pilares | Implementado base | esforços + armadura e 2.ª ordem |
| Flexão biaxial | Implementado no motor | interação simplificada EC2 |
| Corte | Implementado | VRd,c / VRd,s / VRd,max |
| Torção | Implementado base | tubo equivalente + interação |
| Fissuração | Implementado | wk por sr,max e deformação média |
| Deformações | Implementado base | rigidez efetiva + fluência |
| Durabilidade / recobrimento | Implementado | X0/XC/XD/XS |
| Ancoragem | Implementado | lb,rqd e lbd |
| Emendas | Implementado base | l0 |
| Espaçamentos / pormenorização | Implementado | barras e estribos |
| Pilares / esbelteza | Implementado | lambda / lambda_lim |
| 2.ª ordem | Implementado base | curvatura nominal |
| Lajes | Implementado | faixa de 1 m |
| Punçoamento | Implementado base | u1 / vEd / vRd,c |
| Sapatas | Implementado base | flexão X/Y + punçoamento |
| Fadiga | Pré-verificação | requer curvas/ciclos para cálculo detalhado |
| Incêndio | Pré-verificação | confirmação EN 1992-1-2 necessária |
| Pré-esforço | Estrutura futura | não pertence ao âmbito corrente da V1.1 |
| Betão leve | Estrutura futura | parâmetros específicos necessários |
| Escoras e tirantes especiais | Estrutura futura | geometria do nó/tirante necessária |
