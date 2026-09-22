# RJP Structures — Matriz EC2 V1.5

| Módulo | Estado | Observação |
|---|---|---|
| Materiais / resistências de cálculo | Implementado | `alphaCC`, `gammaC`, `gammaS` disponíveis no motor |
| Flexão simples em vigas/lajes | Implementado | bloco retangular + seleção de armaduras |
| Momentos positivo/negativo em vigas | Implementado | armaduras inferior/superior independentes |
| Corte | Implementado | `VRd,c / VRd,s / VRd,max` |
| Estribos por zonas | Implementado | apoio e vão |
| Torção | Implementado base | tubo equivalente + interação V+T |
| Fissuração | Implementado | `wk` por `sr,max` e deformação média |
| Tensões ELS | Implementado base | secção fissurada transformada |
| Deformações | Implementado base | rigidez efetiva + fluência |
| Durabilidade / recobrimento | Implementado | X0/XC/XD/XS |
| Ancoragem | Implementado | `lb,rqd` e `lbd` |
| Emendas | Implementado base | `l0` |
| Espaçamentos / pormenorização | Implementado | barras e estribos |
| Mapa de armaduras | Implementado | quantidade, comprimento e peso estimado |
| Pilares / esbelteza | Implementado | `lambda / lambda_lim` |
| 2.ª ordem | Implementado base | curvatura nominal |
| Armadura de pilares | Implementado base | disposição simétrica esquemática |
| Cintas de pilares | Implementado | diâmetro mínimo e espaçamento máximo |
| Interação N-M de pilares | Triagem conservadora | `N/NRd + M/MRd`; diagrama completo continua recomendado |
| Flexão biaxial | Motor base | função de interação simplificada; requer validação específica |
| Lajes | Implementado base | faixa de 1 m |
| Punçoamento | Implementado base | `u1 / vEd / vRd,c / vRd,max`; `u1` corrigido na V1.5 |
| Sapatas | Implementado base | flexão X/Y + punçoamento |
| Fadiga | Pré-verificação | requer espectro/ciclos para cálculo detalhado |
| Incêndio | Pré-verificação | confirmar pela EN 1992-1-2 |
| Pré-esforço | Futuro | dados/regras específicas |
| Betão leve | Futuro | parâmetros específicos |
| Regiões D / escoras e tirantes | Futuro | geometria e nós específicos |

## Regra de segurança

Um estado `OK` só deve aparecer quando a verificação implementada dispõe dos dados necessários. Casos especializados ou incompletos devem ficar como `WARN/NA`, nunca como verificação integral concluída.
