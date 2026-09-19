# RJP Structures V1.0.0

Base funcional inspirada na simplicidade de utilização de apps de análise de vigas/pórticos, mas com identidade e código próprios.

## Incluído
- UI técnica com grelha, seleção direta de elementos e identidade RJP.
- Modos demonstrativos: Viga, Pórtico 2D e Treliça 2D.
- Motor MEF 2D de pórtico (3 GDL/nó), cargas nodais e carga distribuída uniforme em eixo local y.
- Reações e esforços de extremidade N/V/M.
- Base EC2 para secção retangular: fcd/fyd, As requerida, As mínima, seleção de varões e verificação preliminar de corte.
- Desenho esquemático automático da secção armada.
- Capacitor preparado para Android (`pt.rjp.structures`).
- Workflow GitHub Actions para gerar APK debug.
- Ícones RJP fornecidos integrados em `public/icons`.

## Importante
O módulo EC2 desta V1 é **BETA** e não pretende ainda representar todas as verificações da EN 1992. Antes de utilização profissional é obrigatório validar fórmulas, hipóteses, Anexo Nacional, unidades, combinações e casos de fronteira. A arquitetura foi deixada preparada para acrescentar: ELS fissuração/deformações/tensões, corte completo, torção, punçoamento, pilares/2ª ordem, ancoragens, emendas, durabilidade, lajes, sapatas, incêndio e mapas de armaduras.

## Web
```bash
npm install
npm run dev
```

## Android local
Requer Node 22+ e Android Studio/JDK 21.
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## APK no GitHub
Faça push para `main` ou execute manualmente o workflow **Android APK**. O artefacto produzido chama-se `RJP-Structures-debug-apk`.

## Próxima fase sugerida
1. Editor livre de nós/barras/apoios/cargas.
2. Diagramas contínuos N/V/M e deformada escalável.
3. Casos/combinações ELU/ELS.
4. Motor EC2 validado por verificação, com referência normativa.
5. Detalhamento automático de vigas e pilares (alçado + cortes + mapa de aço).
6. PDF/DXF/SVG e integração RJP Hub / RJP 3D Studio.
