# Verificações efetuadas — V1.8.0

- Verificação TypeScript do projeto (`npm run typecheck`) quando as dependências estão disponíveis.
- Verificação de sintaxe dos workflows YAML e atualização dos artefactos para V1.8.0.
- Verificação da atualização do cache PWA para `rjp-structures-v1.8.0`.
- Revisão do algoritmo de transferência de apoios: o apoio é removido do nó de origem e aplicado ao nó de destino.
- Quando o apoio é largado no interior de uma barra, a barra é dividida em dois elementos com ligações internas rígidas por defeito; libertações de extremidade originais são preservadas apenas nas extremidades exteriores.
- As ações de barra são repartidas entre os dois elementos quando a divisão ocorre.
- Forças/momentos e limites de cargas distribuídas são limitados ao comprimento da barra.

> A validação final do APK e da WebApp deve ser confirmada no GitHub Actions antes de utilização profissional.
