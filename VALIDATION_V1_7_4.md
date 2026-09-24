# Validação V1.7.4 — compositor de cargas

## Interface
- O botão **Carga** abre o separador **Cargas** e expande o painel de propriedades.
- O compositor permite escolher **No nó** ou **Na barra**.
- O local pode ser escolhido por lista ou tocando diretamente num nó/barra no desenho.

## Tipologias
### Nó
- Fx [kN]
- Fy [kN]
- Mz [kNm]

### Barra
- força concentrada transversal Py [kN]
- força concentrada axial Px [kN]
- momento concentrado M [kNm]
- distribuída retangular/uniforme [kN/m]
- triangular 0→q e q→0 [kN/m]
- trapezoidal q1→q2 [kN/m]
- aplicação total ou parcial por x / a–b medidos desde o nó inicial

## Verificações efetuadas
- Parsing/transpilação TypeScript/TSX sem erros sintáticos em App.tsx, structural.ts, ec2.ts e main.tsx.
- service-worker.js validado pelo Node.
- manifest.webmanifest validado como JSON.
- workflows Android e WebApp validados como YAML.

A compilação completa npm depende da instalação das dependências do projeto no runner GitHub Actions.
