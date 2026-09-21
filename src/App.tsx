import {useMemo,useState} from 'react'
import {Element2D,Model2D,Node2D,solveFrame} from './structural'
import {beamEC2,chooseBarsEC2,columnEC2,EC2Check,firePrecheck,slabEC2,punchingEC2,fatigueQuickCheck} from './ec2'

type Mode='Viga'|'Pórtico 2D'|'Treliça 2D'
type Tab='Modelo'|'Resultados'|'EC2'|'Detalhe'|'Relatório'

const E=30_000
function makeModel(mode:Mode):Model2D{
  if(mode==='Viga') return {nodes:[{id:1,x:0,y:0,fixX:true,fixY:true},{id:2,x:3,y:0,fy:-25},{id:3,x:6,y:0,fixY:true}],elements:[
    {id:1,n1:1,n2:2,E,A:300*500,I:300*500**3/12,qy:-8,section:{b:300,h:500,cover:35,fck:30,fyk:500}},
    {id:2,n1:2,n2:3,E,A:300*500,I:300*500**3/12,qy:-8,section:{b:300,h:500,cover:35,fck:30,fyk:500}}]}
  if(mode==='Pórtico 2D') return {nodes:[{id:1,x:0,y:0,fixX:true,fixY:true,fixR:true},{id:2,x:0,y:3},{id:3,x:5,y:3,fx:12},{id:4,x:5,y:0,fixX:true,fixY:true,fixR:true}],elements:[
    {id:1,n1:1,n2:2,E,A:300*300,I:300*300**3/12,section:{b:300,h:300,cover:35,fck:30,fyk:500}},
    {id:2,n1:2,n2:3,E,A:300*500,I:300*500**3/12,qy:-10,section:{b:300,h:500,cover:35,fck:30,fyk:500}},
    {id:3,n1:3,n2:4,E,A:300*300,I:300*300**3/12,section:{b:300,h:300,cover:35,fck:30,fyk:500}}]}
  return {nodes:[{id:1,x:0,y:0,fixX:true,fixY:true},{id:2,x:3,y:3,fy:-20},{id:3,x:6,y:0,fixY:true},{id:4,x:3,y:0}],elements:[
    {id:1,n1:1,n2:2,E,A:2500,I:1},{id:2,n1:2,n2:3,E,A:2500,I:1},{id:3,n1:1,n2:4,E,A:2500,I:1},{id:4,n1:4,n2:3,E,A:2500,I:1},{id:5,n1:2,n2:4,E,A:2500,I:1}]}
}

function fmt(v:number|undefined,d=2){return v!==undefined&&Number.isFinite(v)?v.toFixed(d):'—'}
function statusLabel(s:EC2Check['status']){return s==='OK'?'✓ CUMPRE':s==='FAIL'?'✕ NÃO CUMPRE':s==='WARN'?'⚠ VERIFICAR':'— N/A'}

function ModelView({model,result,selected,setSelected}:{model:Model2D,result:any,selected:number,setSelected:(n:number)=>void}){
  const xs=model.nodes.map(n=>n.x),ys=model.nodes.map(n=>n.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
  const W=900,H=470,p=70,sx=(W-2*p)/Math.max(1,maxX-minX),sy=(H-2*p)/Math.max(1,maxY-minY||3),sc=Math.min(sx,sy)
  const P=(n:Node2D)=>({x:p+(n.x-minX)*sc,y:H-p-(n.y-minY)*sc}); const nodeMap=new Map(model.nodes.map((n,i)=>[n.id,{n,i}]))
  return <svg className="canvas" viewBox={`0 0 ${W} ${H}`}>
    <defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#d8dde2" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/>
    {model.elements.map(e=>{const a=P(nodeMap.get(e.n1)!.n),b=P(nodeMap.get(e.n2)!.n);return <g key={e.id} onClick={()=>setSelected(e.id)} className="clickable"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selected===e.id?'#a80d19':'#14324a'} strokeWidth={selected===e.id?9:6} strokeLinecap="round"/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-10} className="memberLabel">E{e.id}</text>{e.qy&&<><line x1={a.x} y1={a.y-32} x2={b.x} y2={b.y-32} stroke="#d33" strokeWidth="2"/>{Array.from({length:7}).map((_,k)=>{const t=k/6,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;return <line key={k} x1={x} y1={y-32} x2={x} y2={y-4} stroke="#d33" strokeWidth="2"/>})}</>}</g>})}
    {model.nodes.map(n=>{const pnt=P(n);return <g key={n.id}><circle cx={pnt.x} cy={pnt.y} r="7" fill="#fff" stroke="#14324a" strokeWidth="3"/><text x={pnt.x+10} y={pnt.y-10} className="nodeLabel">N{n.id}</text>{(n.fixX||n.fixY||n.fixR)&&<path d={`M ${pnt.x-16} ${pnt.y+18} L ${pnt.x+16} ${pnt.y+18} L ${pnt.x} ${pnt.y+4} Z`} fill="#c4c9ce" stroke="#14324a"/>}{(n.fy??0)!==0&&<><line x1={pnt.x} y1={pnt.y-55} x2={pnt.x} y2={pnt.y-15} stroke="#d33" strokeWidth="3"/><polygon points={`${pnt.x-6},${pnt.y-24} ${pnt.x+6},${pnt.y-24} ${pnt.x},${pnt.y-12}`} fill="#d33"/></>}</g>})}
    {result&&model.nodes.map((n,i)=>{const p0=P(n),ux=result.U[3*Number(i)]*1000,uy=result.U[3*Number(i)+1]*1000;return <circle key={'d'+n.id} cx={p0.x+ux*.25} cy={p0.y-uy*.25} r="3" fill="#1677c8"/>})}
  </svg>
}

function Checks({checks}:{checks:EC2Check[]}){return <div className="checks">{checks.map(c=><div className={`check ${c.status.toLowerCase()}`} key={c.id}><div><b>{c.title}</b><span>{c.note}</span></div><div className="checkvals">{c.demand!==undefined&&<small>{fmt(c.demand)} {c.unit}</small>}<strong>{statusLabel(c.status)}</strong>{c.utilization!==undefined&&Number.isFinite(c.utilization)&&<em>{fmt(c.utilization*100,0)}%</em>}</div></div>)}</div>}

function RebarSection({b,h,cover,bars}:{b:number,h:number,cover:number,bars?:{phi:number,n:number}}){
  const W=330,H=280,p=30,s=Math.min((W-2*p)/b,(H-2*p)/h),rw=b*s,rh=h*s,x=(W-rw)/2,y=(H-rh)/2,n=bars?.n??4
  return <svg viewBox={`0 0 ${W} ${H}`} className="rebarSketch"><rect x={x} y={y} width={rw} height={rh} fill="#f7f7f7" stroke="#303840" strokeWidth="3"/><rect x={x+cover*s} y={y+cover*s} width={rw-2*cover*s} height={rh-2*cover*s} fill="none" stroke="#a80d19" strokeWidth="3" rx="4"/>{Array.from({length:n}).map((_,i)=>{const px=x+cover*s+12+i*(rw-2*cover*s-24)/Math.max(1,n-1);return <circle key={i} cx={px} cy={y+rh-cover*s-14} r="7" fill="#14324a"/>})}<circle cx={x+cover*s+15} cy={y+cover*s+15} r="6" fill="#14324a"/><circle cx={x+rw-cover*s-15} cy={y+cover*s+15} r="6" fill="#14324a"/><text x={W/2} y={H-5} textAnchor="middle" fontSize="14">Corte · {bars?`${bars.n}Ø${bars.phi}`:'armadura'}</text></svg>
}

function BeamElevation({L=6,bars,stirrup='Ø8/150'}:{L?:number,bars?:{phi:number,n:number},stirrup?:string}){
  return <svg viewBox="0 0 680 250" className="rebarSketch"><rect x="55" y="55" width="570" height="120" fill="#f8f8f8" stroke="#303840" strokeWidth="3"/><line x1="75" y1="150" x2="605" y2="150" stroke="#14324a" strokeWidth="5"/><line x1="75" y1="80" x2="605" y2="80" stroke="#14324a" strokeWidth="4"/>{Array.from({length:20}).map((_,i)=><rect key={i} x={78+i*27} y="68" width="18" height="94" fill="none" stroke="#a80d19" strokeWidth="2"/>)}<path d="M55 185 L75 215 L95 185 Z M585 185 L605 215 L625 185 Z" fill="#c3c8cd" stroke="#14324a"/><text x="340" y="35" textAnchor="middle" fontSize="18" fontWeight="700">ALÇADO ESQUEMÁTICO DA VIGA</text><text x="340" y="145" textAnchor="middle" fontSize="16">{bars?`${bars.n}Ø${bars.phi} inferior`:'armadura inferior'}</text><text x="340" y="100" textAnchor="middle" fontSize="16">2Ø12 superior</text><text x="340" y="195" textAnchor="middle" fontSize="16">{stirrup}</text><text x="340" y="232" textAnchor="middle" fontSize="14">L = {fmt(L,2)} m</text></svg>
}

function ColumnSketch({b,h,cover,As}:{b:number,h:number,cover:number,As:number}){const phi=16,n=Math.max(4,Math.ceil(As/(Math.PI*phi*phi/4)));return <div><RebarSection b={b} h={h} cover={cover} bars={{phi,n}}/><svg viewBox="0 0 300 300" className="rebarSketch"><rect x="100" y="25" width="100" height="235" fill="#f8f8f8" stroke="#303840" strokeWidth="3"/>{Array.from({length:12}).map((_,i)=><rect key={i} x="112" y={40+i*17} width="76" height="12" fill="none" stroke="#a80d19" strokeWidth="2"/>)}<line x1="120" y1="35" x2="120" y2="250" stroke="#14324a" strokeWidth="5"/><line x1="180" y1="35" x2="180" y2="250" stroke="#14324a" strokeWidth="5"/><text x="150" y="285" textAnchor="middle" fontSize="14">Pilar · cintas e varões longitudinais</text></svg></div>}

export default function App(){
  const [mode,setMode]=useState<Mode>('Viga'),[selected,setSelected]=useState(1),[tab,setTab]=useState<Tab>('Modelo')
  const model=useMemo(()=>makeModel(mode),[mode]); const result=useMemo(()=>{try{return solveFrame(model)}catch(e){return {error:(e as Error).message}}},[model])
  const member=result?.members?.find((m:any)=>m.id===selected),el=model.elements.find(e=>e.id===selected),n1=model.nodes.find(n=>n.id===el?.n1),n2=model.nodes.find(n=>n.id===el?.n2)
  const med=member?Math.max(Math.abs(member.endForces[2]),Math.abs(member.endForces[5]))/1e6:0,ved=member?Math.max(Math.abs(member.endForces[1]),Math.abs(member.endForces[4]))/1000:0,ned=member?Math.max(Math.abs(member.endForces[0]),Math.abs(member.endForces[3]))/1000:0
  const length=n1&&n2?Math.hypot(n2.x-n1.x,n2.y-n1.y):0,isColumn=!!(n1&&n2&&Math.abs(n2.y-n1.y)>Math.abs(n2.x-n1.x)*1.2)
  const sec=el?.section
  const beam=sec&&!isColumn?beamEC2({...sec,MEd:med,VEd:ved,span:length,phiLong:16,phiSt:8,exposure:'XC2',structuralClass:4,deltaCdev:10,cotTheta:1}):null
  const bars=beam&&sec?chooseBarsEC2(beam.flex.AsReq,sec.b,sec.cover,8,20)[0]:undefined
  const beamFinal=beam&&bars&&sec?beamEC2({...sec,MEd:med,VEd:ved,span:length,phiLong:bars.phi,phiSt:8,AsProv:bars.area,phiBars:bars.phi,nBars:bars.n,AswPerSProv:2*Math.PI*8*8/4/150,stirrupSpacing:150,exposure:'XC2',structuralClass:4,deltaCdev:10,cotTheta:1}):beam
  const col=sec&&isColumn?columnEC2({...sec,NEd:ned,M01:member?Math.abs(member.endForces[2])/1e6:0,M02:member?Math.abs(member.endForces[5])/1e6:0,l0:length,phiLong:16,phiTie:8,creepPhi:2,rm:0}):null
  const slabDemo=slabEC2({h:200,cover:30,fck:30,fyk:500,MEdPerM:35,span:5,phi:12,spacing:150})
  const punchDemo=punchingEC2({c1:300,c2:300,h:220,cover:30,fck:30,fyk:500,VEd:380,rhoL:.006,beta:1.15})
  const fatigue=fatigueQuickCheck(120)
  const fire=sec?firePrecheck(isColumn?'column':'beam',60,sec.b,sec.h,sec.cover+8+8):null
  const nodeIndex=new Map(model.nodes.map((n,i)=>[n.id,i]))
  const checks=beamFinal?.checks??col?.checks??[]
  const ok=checks.filter(c=>c.status==='OK').length,fail=checks.filter(c=>c.status==='FAIL').length,warn=checks.filter(c=>c.status==='WARN').length
  return <div className="app"><header><img src="./icons/ic_launcher.png"/><div><b>RJP STRUCTURES</b><span>MEF 2D · EC2 · Armaduras · Detalhamento</span></div><div className="badge">V1.1</div></header>
    <nav className="modebar">{(['Viga','Pórtico 2D','Treliça 2D'] as Mode[]).map(m=><button key={m} className={m===mode?'active':''} onClick={()=>{setMode(m);setSelected(1);setTab('Modelo')}}>{m}</button>)}</nav>
    <main><section className="workspace"><ModelView model={model} result={result?.error?null:result} selected={selected} setSelected={setSelected}/><div className="tabs">{(['Modelo','Resultados','EC2','Detalhe','Relatório'] as Tab[]).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div></section>
    <aside>
      {tab==='Modelo'&&<><h2>Elemento E{selected}</h2><div className="card"><b>Modelo estrutural</b><p>Tipo: {isColumn?'Pilar':mode==='Treliça 2D'?'Barra axial':'Viga'}</p><p>Comprimento: {fmt(length)} m</p><p>Secção: {sec?`${sec.b} × ${sec.h} mm`:'barra axial'}</p><p>Betão: {sec?`C${sec.fck}/${sec.fck+7}`:'—'} · Aço: {sec?`B${sec.fyk}`:'—'}</p></div><div className="card info"><b>Fluxo</b><p>Modelo → MEF → ELU/ELS → armaduras → pormenorização → desenho esquemático → relatório.</p></div></>}
      {tab==='Resultados'&&<><h2>Resultados MEF</h2>{result?.error?<div className="card danger">{result.error}</div>:<><div className="card"><b>E{selected}</b><p>N1 = {fmt((member?.endForces?.[0]??0)/1000)} kN</p><p>V1 = {fmt((member?.endForces?.[1]??0)/1000)} kN</p><p>M1 = {fmt((member?.endForces?.[2]??0)/1e6)} kNm</p><p>N2 = {fmt((member?.endForces?.[3]??0)/1000)} kN</p><p>V2 = {fmt((member?.endForces?.[4]??0)/1000)} kN</p><p>M2 = {fmt((member?.endForces?.[5]??0)/1e6)} kNm</p></div><div className="card"><b>Reações</b>{model.nodes.map(n=>{const i=nodeIndex.get(n.id)!;return <p key={n.id}>N{n.id}: Rx {fmt(Number(result.R?.[3*Number(i)]??0)/1000)} · Ry {fmt(Number(result.R?.[3*Number(i)+1]??0)/1000)} kN</p>})}</div></>}</>}
      {tab==='EC2'&&<><h2>Verificações EC2</h2>{sec?<><div className="summary"><span className="ok">{ok} OK</span><span className="fail">{fail} falha</span><span className="warn">{warn} verificar</span></div>{beamFinal&&<><div className="card"><b>Viga E{selected}</b><p>MEd = {fmt(med)} kNm · VEd = {fmt(ved)} kN</p><p>As,req = {fmt(beamFinal.flex.AsReq,0)} mm²</p><p>As adotada = {fmt(beamFinal.flex.AsProv,0)} mm² {bars?`(${bars.n}Ø${bars.phi})`:''}</p><p>Asw/s = {fmt(beamFinal.shear.AswPerS,3)} mm²/mm</p><p>wk = {fmt(beamFinal.crack.wk,3)} mm</p><p>δ = {fmt(beamFinal.deflection.delta,2)} mm</p><p>lbd = {fmt(beamFinal.anchorage.lbd,0)} mm · l0 = {fmt(beamFinal.anchorage.l0,0)} mm</p></div><Checks checks={beamFinal.checks}/></>}{col&&<><div className="card"><b>Pilar E{selected}</b><p>NEd = {fmt(ned)} kN</p><p>λ = {fmt(col.lambda,1)} · λlim = {fmt(col.lambdaLim,1)}</p><p>M0e = {fmt(col.M0e)} kNm · M2 = {fmt(col.M2)} kNm</p><p>MEd = {fmt(col.MEd)} kNm</p><p>As,min = {fmt(col.AsMin,0)} mm²</p></div><Checks checks={col.checks}/></>}<details className="card"><summary>Verificações adicionais implementadas</summary><p><b>Lajes:</b> flexão por metro, armadura mínima, fissuração, deformação e espaçamento.</p><p><b>Punçoamento:</b> perímetro u1, vEd, vRd,c e necessidade de armadura.</p><p><b>Torção:</b> tubo equivalente e interação V+T.</p><p><b>Durabilidade:</b> classes X0/XC/XD/XS e cnom.</p><p><b>Ancoragens/emendas:</b> lb,rqd, lbd e l0.</p><p><b>Fadiga:</b> verificação rápida por amplitude de tensão.</p><p><b>Incêndio:</b> pré-verificação tabular conservadora; confirmação final pela EN 1992-1-2.</p><div className="mini"><span>Laje demo: {slabDemo.checks.filter(c=>c.status==='FAIL').length===0?'OK':'verificar'}</span><span>Punçoamento demo: {statusLabel(punchDemo.checks[0].status)}</span><span>Fadiga demo: {statusLabel(fatigue.checks[0].status)}</span><span>R60: {fire?statusLabel(fire.check.status):'—'}</span></div></details></>:<div className="card">A barra de treliça não tem secção de betão associada nesta demonstração.</div>}</>}
      {tab==='Detalhe'&&<><h2>Peça desenhada</h2>{sec&&beamFinal&&!isColumn?<><BeamElevation L={length} bars={bars}/><RebarSection b={sec.b} h={sec.h} cover={sec.cover} bars={bars}/><div className="card"><p><b>Inferior:</b> {bars?`${bars.n}Ø${bars.phi}`:'—'}</p><p><b>Superior:</b> 2Ø12 (mínimo esquemático)</p><p><b>Estribos:</b> Ø8/150 (zonamento automático preparado)</p><p><b>Recobrimento:</b> {sec.cover} mm</p></div></>:sec&&col?<><ColumnSketch b={sec.b} h={sec.h} cover={sec.cover} As={col.AsProv}/><div className="card"><p><b>As,min:</b> {fmt(col.AsMin,0)} mm²</p><p><b>As,max:</b> {fmt(col.AsMax,0)} mm²</p><p><b>2.ª ordem:</b> {col.secondOrderRequired?'considerada':'dispensada pelo critério de esbelteza'}</p></div></>:<div className="card">Detalhamento disponível para peças de betão.</div>}</>}
      {tab==='Relatório'&&<><h2>Relatório EC2</h2><div className="card report"><b>RJP Structures · Elemento E{selected}</b><p>Modelo: {mode} · Tipo: {isColumn?'Pilar':'Viga'}</p><p>Combinação condicionante demonstrativa a partir do MEF.</p><p>Norma alvo: EC2/EN 1992-1-1, com parâmetros configuráveis para metodologia IPL.</p><hr/>{checks.map(c=><p key={c.id}><b>{c.title}:</b> {statusLabel(c.status)} {c.utilization!==undefined&&Number.isFinite(c.utilization)?`(${fmt(c.utilization*100,0)}%)`:''}</p>)}<button className="printBtn" onClick={()=>window.print()}>Imprimir / Guardar PDF</button></div><div className="card warning"><b>Validação profissional</b><p>O motor mostra fórmulas, parâmetros e resultados. Antes de utilização em projeto executivo, validar o Anexo Nacional, coeficientes adotados e casos especiais aplicáveis.</p></div></>}
    </aside></main><footer>RJP Structures V1.1 · EC2 modular · PT-PT · cálculo transparente e desenho esquemático</footer></div>
}
