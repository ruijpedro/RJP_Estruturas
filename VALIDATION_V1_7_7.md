# Validação V1.7.7

## Nós, ligações rígidas e rótulas

Testes diretos do motor `structural.ts`:

1. **Viga contínua, 2 vãos de 5 m, q = 10 kN/m**, sem libertações: momento no apoio intermédio = **31,25 kNm** em módulo. Confirma transmissão de momento através do nó.
2. Mesmo modelo, com libertação rotacional nas duas barras junto ao apoio intermédio: momentos libertados = **0,00 kNm**; reações = **25 / 50 / 25 kN**.
3. **Viga 6 m encastrada-encastrada, q = 10 kN/m**: momentos de extremidade = **30,00 kNm** em módulo e reações verticais = **30 / 30 kN**.
4. Mesmo elemento com rótula apenas no início: momento inicial = **0,00 kNm**, confirmando a libertação rotacional.
5. Elementos sem `releaseStartR` e `releaseEndR` são interpretados como **rígidos**, garantindo compatibilidade com projetos anteriores.

A verificação do APK/WebApp completo deve ainda ser confirmada no GitHub Actions, porque a instalação npm no ambiente de preparação atingiu o limite de tempo de rede.
