import {useMemo,useState} from 'react'
import {chooseBars,ec2RectangularBeam,Element2D,Model2D,Node2D,solveFrame} from './structural'

type Mode='Viga'|'Pórtico 2D'|'Treliça 2D'

const E=30_000 // N/mm2
function makeModel(mode:Mode):Model2D{
  if(mode==='Viga') return {
    nodes:[
      {id:1,x:0,y:0,fixX:true,fixY:true},
      {id:2,x:3,y:0,fy:-25},
      {id:3,x:6,y:0,fixY:true}
    ],
    elements:[
      {id:1,n1:1,n2:2,E,A:300*500,I:300*500**3/12,qy:-8,section:{b:300,h:500,cover:30,fck:30,fyk:500}},
      {id:2,n1:2,n2:3,E,A:300*500,I:300*500**3/12,qy:-8,section:{b:300,h:500,cover:30,fck:30,fyk:500}}
    ]
  }
  if(mode==='Pórtico 2D') return {
    nodes:[
      {id:1,x:0,y:0,fixX:true,fixY:true,fixR:true},
      {id:2,x:0,y:3},
      {id:3,x:5,y:3,fx:12},
      {id:4,x:5,y:0,fixX:true,fixY:true,fixR:true}
    ],
    elements:[
      {id:1,n1:1,n2:2,E,A:300*300,I:300*300**3/12,section:{b:300,h:300,cover:30,fck:30,fyk:500}},
      {id:2,n1:2,n2:3,E,A:300*500,I:300*500**3/12,qy:-10,section:{b:300,h:500,cover:30,fck:30,fyk:500}},
      {id:3,n1:3,n2:4,E,A:300*300,I:300*300**3/12,section:{b:300,h:300,cover:30,fck:30,fyk:500}}
    ]
  }
  return {
    nodes:[
      {id:1,x:0,y:0,fixX:true,fixY:true},
      {id:2,x:3,y:3,fy:-20},
      {id:3,x:6,y:0,fixY:true},
      {id:4,x:3,y:0}
    ],
    elements:[
      {id:1,n1:1,n2:2,E,A:2500,I:1}, {id:2,n1:2,n2:3,E,A:2500,I:1},
      {id:3,n1:1,n2:4,E,A:2500,I:1}, {id:4,n1:4,n2:3,E,A:2500,I:1},
      {id:5,n1:2,n2:4,E,A:2500,I:1}
    ]
  }
}

function fmt(v:number,d=2){return Number.isFinite(v)?v.toFixed(d):'—'}

function ModelView({model,result,selected,setSelected}:{model:Model2D,result:any,selected:number,setSelected:(n:number)=>void}){
  const xs=model.nodes.map(n=>n.x),ys=model.nodes.map(n=>n.y)
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys)
  const W=900,H=470,p=70,sx=(W-2*p)/Math.max(1,maxX-minX),sy=(H-2*p)/Math.max(1,maxY-minY||3),sc=Math.min(sx,sy)
  const P=(n:Node2D)=>({x:p+(n.x-minX)*sc,y:H-p-(n.y-minY)*sc})
  const nodeMap=new Map(model.nodes.map((n,i)=>[n.id,{n,i}]))
  return <svg className="canvas" viewBox={`0 0 ${W} ${H}`}>
    <defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="#d8dde2" strokeWidth="1"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    {model.elements.map(e=>{const a=P(nodeMap.get(e.n1)!.n),b=P(nodeMap.get(e.n2)!.n);return <g key={e.id} onClick={()=>setSelected(e.id)} className="clickable">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={selected===e.id?'#a80d19':'#14324a'} strokeWidth={selected===e.id?9:6} strokeLinecap="round"/>
      <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-10} className="memberLabel">E{e.id}</text>
      {e.qy && <><line x1={a.x} y1={a.y-32} x2={b.x} y2={b.y-32} stroke="#d33" strokeWidth="2"/>
        {Array.from({length:7}).map((_,k)=>{const t=k/6,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;return <line key={k} x1={x} y1={y-32} x2={x} y2={y-4} stroke="#d33" strokeWidth="2"/>})}</>}
    </g>})}
    {model.nodes.map((n,i)=>{const pnt=P(n);return <g key={n.id}>
      <circle cx={pnt.x} cy={pnt.y} r="7" fill="#fff" stroke="#14324a" strokeWidth="3"/>
      <text x={pnt.x+10} y={pnt.y-10} className="nodeLabel">N{n.id}</text>
      {(n.fixX||n.fixY||n.fixR)&&<path d={`M ${pnt.x-16} ${pnt.y+18} L ${pnt.x+16} ${pnt.y+18} L ${pnt.x} ${pnt.y+4} Z`} fill="#c4c9ce" stroke="#14324a"/>}
      {(n.fy??0)!==0&&<><line x1={pnt.x} y1={pnt.y-55} x2={pnt.x} y2={pnt.y-15} stroke="#d33" strokeWidth="3"/><polygon points={`${pnt.x-6},${pnt.y-24} ${pnt.x+6},${pnt.y-24} ${pnt.x},${pnt.y-12}`} fill="#d33"/></>}
    </g>})}
    {result && model.nodes.map((n,i)=>{const p0=P(n), ux=result.U[3*i]*1000, uy=result.U[3*i+1]*1000;return <circle key={'d'+n.id} cx={p0.x+ux*0.25} cy={p0.y-uy*0.25} r="3" fill="#1677c8"/>})}
  </svg>
}

function RebarSketch({b,h,cover,bars}:{b:number,h:number,cover:number,bars:{phi:number,n:number}|undefined}){
  const W=300,H=260,p=30, sx=(W-2*p)/b,sy=(H-2*p)/h,s=Math.min(sx,sy),rw=b*s,rh=h*s,x=(W-rw)/2,y=(H-rh)/2
  const n=bars?.n??4
  return <svg viewBox={`0 0 ${W} ${H}`} className="rebarSketch">
    <rect x={x} y={y} width={rw} height={rh} fill="#f0f0f0" stroke="#333" strokeWidth="3"/>
    <rect x={x+cover*s} y={y+cover*s} width={rw-2*cover*s} height={rh-2*cover*s} fill="none" stroke="#a80d19" strokeWidth="3" rx="4"/>
    {Array.from({length:n}).map((_,i)=>{const px=x+cover*s+12 + i*(rw-2*cover*s-24)/Math.max(1,n-1);return <circle key={i} cx={px} cy={y+rh-cover*s-14} r="7" fill="#14324a"/>})}
    <circle cx={x+cover*s+15} cy={y+cover*s+15} r="6" fill="#14324a"/><circle cx={x+rw-cover*s-15} cy={y+cover*s+15} r="6" fill="#14324a"/>
    <text x={W/2} y={H-4} textAnchor="middle" fontSize="14">Corte esquemático · {bars?`${bars.n}Ø${bars.phi}`:'—'}</text>
  </svg>
}

export default function App(){
  const [mode,setMode]=useState<Mode>('Viga'), [selected,setSelected]=useState(1), [tab,setTab]=useState<'Modelo'|'Resultados'|'EC2'|'Detalhe'>('Modelo')
  const model=useMemo(()=>makeModel(mode),[mode])
  const result=useMemo(()=>{try{return solveFrame(model)}catch(e){return {error:(e as Error).message}}},[model])
  const member=result?.members?.find((m:any)=>m.id===selected)
  const el=model.elements.find(e=>e.id===selected)
  const med=member?Math.max(Math.abs(member.endForces[2]),Math.abs(member.endForces[5]))/1e6:0
  const ved=member?Math.max(Math.abs(member.endForces[1]),Math.abs(member.endForces[4]))/1000:0
  const ec2=el?.section?ec2RectangularBeam({...el.section,med,ved}):null
  const bars=ec2?chooseBars(ec2.As)[0]:undefined
  const nodeIndex=new Map(model.nodes.map((n,i)=>[n.id,i]))
  return <div className="app">
    <header><img src="./icons/ic_launcher.png"/><div><b>RJP STRUCTURES</b><span>MEF 2D · EC2 · Detalhamento</span></div><div className="badge">V1.0</div></header>
    <nav className="modebar">{(['Viga','Pórtico 2D','Treliça 2D'] as Mode[]).map(m=><button key={m} className={m===mode?'active':''} onClick={()=>{setMode(m);setSelected(1);setTab('Modelo')}}>{m}</button>)}</nav>
    <main>
      <section className="workspace"><ModelView model={model} result={result?.error?null:result} selected={selected} setSelected={setSelected}/>
        <div className="tabs">{(['Modelo','Resultados','EC2','Detalhe'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
      </section>
      <aside>
        {tab==='Modelo'&&<><h2>Elemento E{selected}</h2><div className="card"><b>Geometria</b><p>Material: Betão C30/37 (modelo demo)</p><p>Secção: {el?.section?`${el.section.b} × ${el.section.h} mm`:'Barra axial'}</p><p>Carga distribuída: {el?.qy??0} kN/m</p></div><div className="card warning">Editor gráfico preparado para seleção direta de barras, nós, cargas e apoios. Nesta V1 os modelos são demonstrativos.</div></>}
        {tab==='Resultados'&&<><h2>Resultados MEF</h2>{result?.error?<div className="card danger">{result.error}</div>:<><div className="card"><b>E{selected}</b><p>N1 = {fmt(member?.endForces?.[0]/1000)} kN</p><p>V1 = {fmt(member?.endForces?.[1]/1000)} kN</p><p>M1 = {fmt(member?.endForces?.[2]/1e6)} kNm</p><p>N2 = {fmt(member?.endForces?.[3]/1000)} kN</p><p>V2 = {fmt(member?.endForces?.[4]/1000)} kN</p><p>M2 = {fmt(member?.endForces?.[5]/1e6)} kNm</p></div><div className="card"><b>Reações</b>{model.nodes.map(n=>{const i=nodeIndex.get(n.id)!;return <p key={n.id}>N{n.id}: Rx {fmt(result.R[3*i]/1000)} · Ry {fmt(result.R[3*i+1]/1000)} kN</p>})}</div></>}</>}
        {tab==='EC2'&&<><h2>Verificações EC2</h2>{ec2?<><div className="card"><p><b>MEd</b> {fmt(med)} kNm</p><p><b>VEd</b> {fmt(ved)} kN</p><p><b>d</b> {fmt(ec2.d,0)} mm</p><p><b>As,req</b> {fmt(ec2.AsReq,0)} mm²</p><p><b>As,min</b> {fmt(ec2.AsMin,0)} mm²</p><p><b>As adotada</b> {fmt(ec2.As,0)} mm²</p><p><b>VRd,c</b> {fmt(ec2.vrdc)} kN</p><p><b>Corte</b> {ec2.shearNeedsStirrups?'Armadura transversal necessária':'Sem necessidade calculada além da mínima'}</p></div><div className="card"><b>Soluções de armadura</b>{chooseBars(ec2.As).map((s,i)=><p key={i}>{s.n}Ø{s.phi} = {fmt(s.area,0)} mm² {i===0?'✓':''}</p>)}</div><div className="card warning"><b>EC2 BETA</b><p>Implementadas nesta base: resistências de cálculo, flexão retangular simplificada, As mín., seleção de varões e verificação preliminar de corte.</p><p>Fissuração, deformações, torção, punçoamento, 2.ª ordem, ancoragens/emendas e restantes regras estão estruturadas para serem acrescentadas e validadas.</p></div></>:<div className="card">O modo treliça não tem secção de betão associada nesta demonstração.</div>}</>}
        {tab==='Detalhe'&&<><h2>Peça desenhada</h2>{el?.section?<><RebarSketch b={el.section.b} h={el.section.h} cover={el.section.cover} bars={bars}/><div className="card"><p><b>Armadura longitudinal:</b> {bars?`${bars.n}Ø${bars.phi}`:'—'}</p><p><b>Recobrimento:</b> {el.section.cover} mm</p><p><b>Estribos:</b> cálculo/zonamento preparado para próxima revisão normativa.</p></div></>:<div className="card">Detalhamento disponível para elementos de betão.</div>}</>}
      </aside>
    </main>
    <footer>RJP Structures · Protótipo técnico. Resultados não substituem validação de projeto nem revisão normativa.</footer>
  </div>
}
