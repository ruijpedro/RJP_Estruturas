# RJP Structures V1.7.8

## Apoios diretamente ligados à barra

- Corrigida a representação gráfica para que um apoio articulado ou móvel fique diretamente encostado à viga, sem um círculo intermédio que pudesse ser confundido com uma rótula.
- Um apoio já não cria qualquer libertação rotacional na barra. **Apoio ≠ rótula**.
- As barras de viga/pórtico continuam a nascer com `releaseStartR=false` e `releaseEndR=false`, isto é, com extremidades rígidas por defeito.
- Uma rótula só existe quando é ativada explicitamente em **Ligações da barra** e é então desenhada com círculo branco/vermelho e a letra **R**.
- Os nós MEF ficam ocultos por defeito no modelo novo. Quando o utilizador ativa **Nós MEF**, os nós sem apoio são mostrados como pequenos quadrados, não como círculos. Nos nós com apoio não é desenhado marcador intermédio.
- O símbolo do apoio passou a tocar diretamente no eixo da barra.
- O modelo **Padrão** e o modelo **Começar por apoios** abrem com os nós técnicos ocultos.

## Compatibilidade

Mantêm-se os vários tipos de ações, momentos, editor gráfico, MEF 2D, EC2, Pormenorização, gravação automática, WebApp/PWA e APK Android.
