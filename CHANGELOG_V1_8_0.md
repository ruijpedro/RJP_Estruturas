# RJP Structures V1.8.0 — Grab & Drag / Grip

## Editor gráfico
- Grab & Drag ativado por defeito no modo **Selecionar** e **Mover**.
- Apoios realçados ao passar o rato; clicar/pressionar e arrastar reposiciona o vínculo.
- Ao largar um apoio no interior de uma barra, a app cria automaticamente o nó MEF necessário e divide a barra sem introduzir rótulas.
- Forças concentradas e momentos de barra podem deslizar diretamente ao longo da barra.
- Cargas distribuídas apresentam grips nos limites `x1` e `x2`, permitindo alterar graficamente o intervalo carregado.
- Nós visíveis podem ser arrastados diretamente.
- Pré-visualização da posição durante o arrasto.

## Snap
- Novo ajuste **Definições → Grab & Drag → Snap**: livre, 5 cm, 10 cm, 25 cm, 50 cm ou 1,00 m.
- O apoio continua estruturalmente associado a um nó; quando necessário esse nó é criado automaticamente.

## Compatibilidade
- Mantém editor contextual V1.7.9, múltiplos tipos de carga, momentos, apoios, ligações rígidas/rótulas, MEF 2D, EC2, WebApp/PWA e Android.
- Projetos anteriores continuam a ser lidos; as novas opções de interface recebem valores por defeito.
