# Validação V1.6.1

## Verificação de código

- `App.tsx`, `structural.ts` e `ec2.ts` foram analisados pelo transpilador TypeScript 5.8.3 sem diagnósticos sintáticos.
- A instalação completa de dependências não foi concluída neste ambiente por indisponibilidade/timeout do registry; o workflow GitHub Actions mantém `npm install` antes do build.

## Comportamento esperado da ferramenta Apagar

1. **Força nodal vertical/horizontal:** a componente é anulada no modelo e o MEF recalcula.
2. **Momento nodal:** a componente `mz` é anulada.
3. **Carga distribuída:** `qy` é anulada no elemento selecionado graficamente.
4. **Apoio:** `fixX`, `fixY` e `fixR` do nó são removidos.
5. Se o modelo ficar cinematicamente instável depois de remover um apoio, o solver deve devolver a mensagem de matriz singular/instabilidade.
6. O botão **Repor ações e apoios do modelo** limpa as remoções gráficas do modo atual.
7. Alterar novamente um valor no separador **Cargas** reativa a ação paramétrica correspondente.
