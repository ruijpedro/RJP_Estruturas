# Validação V1.7.0

## Verificações executadas

- Verificação TypeScript dos módulos `App.tsx`, `structural.ts` e `ec2.ts` com `strict` ativo e stubs mínimos de React: sem erros de tipo relevantes.
- Compatibilidade dos dados de edição da V1.6.1 através de normalização dos novos campos.
- O modelo continua a passar integralmente pelo mesmo solver MEF após edição de apoios e cargas.
- As alterações de acessibilidade são persistidas separadamente dos parâmetros estruturais.
- A gravação automática utiliza um snapshot completo do projeto e não substitui o ficheiro JSON exportado pelo utilizador.

## Nota de build

O `npm install` não concluiu neste ambiente por indisponibilidade/timeout do registry. O workflow GitHub Actions mantém Node 24, Java 21, Capacitor 7 e a correção do recurso do ícone adaptativo Android.
