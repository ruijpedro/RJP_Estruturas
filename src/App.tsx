import {ChangeEvent,MouseEvent as ReactMouseEvent,PointerEvent as ReactPointerEvent,useEffect,useMemo,useState} from 'react'
import {FrameResult,MemberResult,Model2D,Node2D,solveFrame} from './structural'
import {
  beamEC2,chooseBarsEC2,chooseColumnBarsEC2,chooseStirrupsEC2,columnEC2,concreteProps,EC2Check,
  ExposureClass,firePrecheck,footingEC2,slabEC2,punchingEC2,fatigueQuickCheck
} from './ec2'

type Mode='Viga'|'Pórtico 2D'|'Treliça 2D'
type Tab='Modelo'|'Cargas'|'Resultados'|'EC2'|'Pormenorização'|'Relatório'|'Definições'
type AnalysisState={ok:true;data:FrameResult}|{ok:false;error:string}
type Tool='Selecionar'|'Nó'|'Barra'|'Apoio'|'Carga'|'Mover'|'Apagar'
type CanvasResult='Deformada'|'N'|'V'|'M'

type Settings={
  fck:number; fyk:number; cover:number; exposure:ExposureClass; cotTheta:number;
  beamSpan:number; beamQ:number; beamP:number; beamB:number; beamH:number;
  frameWidth:number; frameHeight:number; frameQ:number; frameHLoad:number; colB:number; colH:number;
  trussSpan:number; trussHeight:number; trussP:number; trussA:number;
}

type ProjectFile={version:string;mode:Mode;settings:Settings;model?:Model2D;snap?:number}

type RebarRow={mark:string;description:string;phi:number;qty:number;lengthM:number;weightKg:number}

const DEFAULT_SETTINGS:Settings={
  fck:30,fyk:500,cover:35,exposure:'XC2',cotTheta:1,
  beamSpan:6,beamQ:8,beamP:25,beamB:300,beamH:500,
  frameWidth:5,frameHeight:3,frameQ:10,frameHLoad:12,colB:300,colH:300,
  trussSpan:6,trussHeight:3,trussP:20,trussA:2500
}

function clamp(v:number,a:number,b:number){return Math.max(a,Math.min(b,v))}
function fmt(v:number|undefined,d=2){return v!==undefined&&Number.isFinite(v)?v.toFixed(d):'—'}
function statusLabel(s:EC2Check['status']){return s==='OK'?'✓ CUMPRE':s==='FAIL'?'✕ NÃO CUMPRE':s==='WARN'?'⚠ VERIFICAR':'— N/A'}
function maxAbs(values:number[]){return values.reduce((m,v)=>Math.max(m,Math.abs(v)),0)}
function kgPerM(phi:number){return phi*phi/162}
function barWeight(phi:number,qty:number,lengthM:number){return kgPerM(phi)*qty*lengthM}

function criticalSample(member:MemberResult|undefined,key:'N'|'V'|'M'){
  if(!member?.samples.length) return {value:0,x:0}
  return member.samples.reduce((best,s)=>Math.abs(s[key])>Math.abs(best.value)?{value:s[key],x:s.x}:best,{value:member.samples[0][key],x:member.samples[0].x})
}

function momentExtrema(member:MemberResult|undefined){
  if(!member?.samples.length) return {positive:0,negative:0}
  let positive=0,negative=0
  for(const s of member.samples){
    positive=Math.max(positive,s.M)
    negative=Math.max(negative,-s.M)
  }
  return {positive:positive/1e6,negative:negative/1e6}
}

function makeModel(mode:Mode,s:Settings):Model2D{
  const Erc=concreteProps(s.fck).Ecm
  const beamSection={b:s.beamB,h:s.beamH,cover:s.cover,fck:s.fck,fyk:s.fyk}
  const colSection={b:s.colB,h:s.colH,cover:s.cover,fck:s.fck,fyk:s.fyk}
  if(mode==='Viga'){
    const L=Math.max(1,s.beamSpan)
    return {
      nodes:[
        {id:1,x:0,y:0,fixX:true,fixY:true},
        {id:2,x:L/2,y:0,fy:-Math.abs(s.beamP)},
        {id:3,x:L,y:0,fixY:true}
      ],
      elements:[
        {id:1,n1:1,n2:2,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,qy:-Math.abs(s.beamQ),section:beamSection},
        {id:2,n1:2,n2:3,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,qy:-Math.abs(s.beamQ),section:beamSection}
      ]
    }
  }
  if(mode==='Pórtico 2D'){
    const W=Math.max(1,s.frameWidth),H=Math.max(1,s.frameHeight)
    return {
      nodes:[
        {id:1,x:0,y:0,fixX:true,fixY:true,fixR:true},
        {id:2,x:0,y:H},
        {id:3,x:W,y:H,fx:Math.abs(s.frameHLoad)},
        {id:4,x:W,y:0,fixX:true,fixY:true,fixR:true}
      ],
      elements:[
        {id:1,n1:1,n2:2,E:Erc,A:s.colB*s.colH,I:s.colB*s.colH**3/12,section:colSection},
        {id:2,n1:2,n2:3,E:Erc,A:s.beamB*s.beamH,I:s.beamB*s.beamH**3/12,qy:-Math.abs(s.frameQ),section:beamSection},
        {id:3,n1:3,n2:4,E:Erc,A:s.colB*s.colH,I:s.colB*s.colH**3/12,section:colSection}
      ]
    }
  }
  const L=Math.max(1,s.trussSpan),H=Math.max(.5,s.trussHeight)
  const ESteel=210_000
  return {
    nodes:[
      {id:1,x:0,y:0,fixX:true,fixY:true},
      {id:2,x:L/2,y:H,fy:-Math.abs(s.trussP)},
      {id:3,x:L,y:0,fixY:true},
      {id:4,x:L/2,y:0}
    ],
    elements:[
      {id:1,n1:1,n2:2,E:ESteel,A:s.trussA,I:0,kind:'truss'},
      {id:2,n1:2,n2:3,E:ESteel,A:s.trussA,I:0,kind:'truss'},
      {id:3,n1:1,n2:4,E:ESteel,A:s.trussA,I:0,kind:'truss'},
      {id:4,n1:4,n2:3,E:ESteel,A:s.trussA,I:0,kind:'truss'},
      {id:5,n1:2,n2:4,E:ESteel,A:s.trussA,I:0,kind:'truss'}
    ]
  }
}

function NumInput({label,value,onChange,unit,step=1,min}:{label:string;value:number;onChange:(v:number)=>void;unit?:string;step?:number;min?:number}){
  return <label className="field"><span>{label}</span><div><input type="number" value={Number.isFinite(value)?value:''} step={step} min={min} onChange={(e:ChangeEvent<HTMLInputElement>)=>{const n=Number(e.target.value);if(Number.isFinite(n))onChange(min!==undefined?Math.max(min,n):n)}}/>{unit&&<small>{unit}</small>}</div></label>
}

function ModelView({
  model,result,selectedElement,selectedNode,tool,barStart,snap,diagram,
  onSelectElement,onSelectNode,onAddNode,onBarNode,onToggleSupport,onApplyNodeLoad,onApplyElementLoad,onDeleteElement,onDeleteNode,onMoveNode
}:{
  model:Model2D;result:FrameResult|null;selectedElement:number;selectedNode:number|null;tool:Tool;barStart:number|null;snap:number;diagram:CanvasResult;
  onSelectElement:(id:number)=>void;onSelectNode:(id:number)=>void;onAddNode:(x:number,y:number)=>void;onBarNode:(id:number)=>void;
  onToggleSupport:(id:number)=>void;onApplyNodeLoad:(id:number)=>void;onApplyElementLoad:(id:number)=>void;onDeleteElement:(id:number)=>void;onDeleteNode:(id:number)=>void;onMoveNode:(id:number,x:number,y:number)=>void;
}){
  const W=940,H=520,p=62
  const xs=model.nodes.map(n=>n.x),ys=model.nodes.map(n=>n.y)
  const minX=Math.min(-1,...xs)-.5,maxX=Math.max(7,...xs)+.5,minY=Math.min(-1,...ys)-.5,maxY=Math.max(4,...ys)+.5
  const sx=(W-2*p)/Math.max(1,maxX-minX),sy=(H-2*p)/Math.max(1,maxY-minY),sc=Math.min(sx,sy)
  const P=(n:Node2D)=>({x:p+(n.x-minX)*sc,y:H-p-(n.y-minY)*sc})
  const nodeMap=new Map(model.nodes.map((n,i)=>[n.id,{n,i}]))
  const maxTrans=result?Math.max(0.001,...model.nodes.flatMap((_,i)=>[Math.abs(result.U[3*i]??0),Math.abs(result.U[3*i+1]??0)])):1
  const deformScale=result?Math.min(80,48/maxTrans):1
  const DP=(n:Node2D)=>{const base=P(n),i=nodeMap.get(n.id)!.i;return {x:base.x+((result?.U[3*i]??0)/1000)*sc*deformScale,y:base.y-((result?.U[3*i+1]??0)/1000)*sc*deformScale}}
  const selectedEl=model.elements.find(e=>e.id===selectedElement)
  const selectedResult=result?.members.find(m=>m.id===selectedElement)
  let diagramPoints='',diagramMax=0
  if(result&&selectedEl&&selectedResult&&diagram!=='Deformada'&&selectedResult.samples.length>1){
    const na=nodeMap.get(selectedEl.n1)?.n,nb=nodeMap.get(selectedEl.n2)?.n
    if(na&&nb){
      const a=P(na),b=P(nb),dx=b.x-a.x,dy=b.y-a.y,Lpx=Math.hypot(dx,dy)||1,nx=-dy/Lpx,ny=dx/Lpx
      const vals=selectedResult.samples.map(sm=>sm[diagram]);diagramMax=Math.max(1,...vals.map(v=>Math.abs(v)))
      diagramPoints=selectedResult.samples.map(sm=>{const t=selectedResult.L>0?sm.x/selectedResult.L:0,baseX=a.x+dx*t,baseY=a.y+dy*t,off=(sm[diagram]/diagramMax)*72;return `${baseX+nx*off},${baseY+ny*off}`}).join(' ')
    }
  }
  const selectedUnit=diagram==='M'?'kNm':'kN',selectedFactor=diagram==='M'?1e6:1000
  const [dragging,setDragging]=useState<number|null>(null)
  const [cursor,setCursor]=useState<{x:number;y:number}|null>(null)
  const clientToWorld=(ev:ReactPointerEvent<SVGSVGElement>|ReactMouseEvent<SVGSVGElement>)=>{
    const r=ev.currentTarget.getBoundingClientRect(),px=(ev.clientX-r.left)*W/r.width,py=(ev.clientY-r.top)*H/r.height
    const x=minX+(px-p)/sc,y=minY+(H-p-py)/sc
    const q=(v:number)=>Math.round(v/Math.max(.01,snap))*Math.max(.01,snap)
    return {x:q(x),y:q(y)}
  }
  const pointerMove=(ev:ReactPointerEvent<SVGSVGElement>)=>{const w=clientToWorld(ev);setCursor(w);if(dragging!==null&&tool==='Mover')onMoveNode(dragging,w.x,w.y)}
  const pointerUp=()=>setDragging(null)
  const blankClick=(ev:ReactMouseEvent<SVGSVGElement>)=>{if(ev.target!==ev.currentTarget&&!(ev.target as SVGElement).classList.contains('canvas-bg'))return;if(tool==='Nó'){const w=clientToWorld(ev);onAddNode(w.x,w.y)}}
  const elementClick=(ev:ReactMouseEvent<SVGGElement>,id:number)=>{ev.stopPropagation();if(tool==='Apagar')onDeleteElement(id);else if(tool==='Carga')onApplyElementLoad(id);else onSelectElement(id)}
  const nodeClick=(ev:ReactMouseEvent<SVGGElement>,id:number)=>{ev.stopPropagation();if(tool==='Barra')onBarNode(id);else if(tool==='Apoio')onToggleSupport(id);else if(tool==='Carga')onApplyNodeLoad(id);else if(tool==='Apagar')onDeleteNode(id);else if(tool!=='Mover')onSelectNode(id)}
  const supportSymbol=(n:Node2D,pnt:{x:number;y:number})=>{
    if(!(n.fixX||n.fixY||n.fixR))return null
    if(n.fixX&&n.fixY&&n.fixR)return <g><rect x={pnt.x-17} y={pnt.y+6} width="34" height="16" fill="#dfe4e8" stroke="#263b4d" strokeWidth="2"/><line x1={pnt.x-24} y1={pnt.y+24} x2={pnt.x+24} y2={pnt.y+24} stroke="#263b4d" strokeWidth="2"/></g>
    return <g><path d={`M ${pnt.x-18} ${pnt.y+20} L ${pnt.x+18} ${pnt.y+20} L ${pnt.x} ${pnt.y+5} Z`} fill="#e8eaec" stroke="#263b4d" strokeWidth="2"/><line x1={pnt.x-24} y1={pnt.y+22} x2={pnt.x+24} y2={pnt.y+22} stroke="#263b4d" strokeWidth="2"/>{!n.fixX&&n.fixY&&<><circle cx={pnt.x-8} cy={pnt.y+27} r="3" fill="#fff" stroke="#263b4d"/><circle cx={pnt.x+8} cy={pnt.y+27} r="3" fill="#fff" stroke="#263b4d"/></>}</g>
  }
  return <svg className={`canvas tool-${tool.toLowerCase()}`} viewBox={`0 0 ${W} ${H}`} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerUp} onClick={blankClick}>
    <defs>
      <pattern id="gridSmall" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e7eaed" strokeWidth="1"/></pattern>
      <pattern id="gridLarge" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#gridSmall)"/><path d="M 100 0 L 0 0 0 100" fill="none" stroke="#cfd5da" strokeWidth="1.2"/></pattern>
      <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c91c23"/></marker>
    </defs>
    <rect className="canvas-bg" width="100%" height="100%" fill="#fbfcfd"/><rect className="canvas-bg" width="100%" height="100%" fill="url(#gridLarge)"/>
    <g opacity=".75"><line x1="35" y1={H-35} x2="88" y2={H-35} stroke="#17324b" strokeWidth="2"/><line x1="35" y1={H-35} x2="35" y2={H-88} stroke="#17324b" strokeWidth="2"/><text x="92" y={H-30} className="axisLabel">X</text><text x="26" y={H-92} className="axisLabel">Y</text></g>
    {model.elements.map(e=>{const na=nodeMap.get(e.n1)?.n,nb=nodeMap.get(e.n2)?.n;if(!na||!nb)return null;const a=P(na),b=P(nb),active=selectedElement===e.id&&selectedNode===null;return <g key={e.id} onClick={(ev:ReactMouseEvent<SVGGElement>)=>elementClick(ev,e.id)} className="clickable"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="22"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active?'#1e63b5':'#263b4d'} strokeWidth={active?10:7} strokeLinecap="round"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d8d8d8" strokeWidth={active?6:4} strokeLinecap="round"/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-13} className="memberLabel">B{e.id}</text>{e.qy&&<><line x1={a.x} y1={a.y-38} x2={b.x} y2={b.y-38} stroke="#c91c23" strokeWidth="2"/>{Array.from({length:8}).map((_,k)=>{const t=k/7,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;return <line key={k} x1={x} y1={y-38} x2={x} y2={y-8} stroke="#c91c23" strokeWidth="2" markerEnd="url(#arrowRed)"/>})}<text x={(a.x+b.x)/2} y={(a.y+b.y)/2-50} textAnchor="middle" className="loadLabel">q = {Math.abs(e.qy)} kN/m</text></>}</g>})}
    {result&&diagram==='Deformada'&&model.elements.map(e=>{const na=nodeMap.get(e.n1)?.n,nb=nodeMap.get(e.n2)?.n;if(!na||!nb)return null;const a=DP(na),b=DP(nb);return <line key={`def-${e.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#1476d4" strokeWidth="3" strokeDasharray="8 6" opacity=".95"/>})}
    {result&&diagram!=='Deformada'&&diagramPoints&&<><polyline points={diagramPoints} fill="none" stroke="#c91c23" strokeWidth="3.5"/><text x={W-215} y="35" className="diagramLabel">{diagram}: máx. {fmt(diagramMax/selectedFactor,2)} {selectedUnit}</text></>}
    {model.nodes.map(n=>{const pnt=P(n),active=selectedNode===n.id||barStart===n.id;return <g key={n.id} className="nodeHit" onClick={(ev:ReactMouseEvent<SVGGElement>)=>nodeClick(ev,n.id)} onPointerDown={(ev:ReactPointerEvent<SVGGElement>)=>{if(tool==='Mover'){ev.stopPropagation();setDragging(n.id);onSelectNode(n.id)}}}><circle cx={pnt.x} cy={pnt.y} r="16" fill="transparent"/><circle cx={pnt.x} cy={pnt.y} r={active?10:8} fill={barStart===n.id?'#fff4c2':'#fff'} stroke={active?'#1e63b5':'#263b4d'} strokeWidth={active?4:3}/><text x={pnt.x+11} y={pnt.y-11} className="nodeLabel">N{n.id}</text>{supportSymbol(n,pnt)}{(n.fy??0)!==0&&<><line x1={pnt.x} y1={pnt.y-70} x2={pnt.x} y2={pnt.y-18} stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={pnt.x+10} y={pnt.y-58} className="loadLabel">Fy = {fmt(n.fy)} kN</text></>}{(n.fx??0)!==0&&<><line x1={pnt.x-70} y1={pnt.y} x2={pnt.x-18} y2={pnt.y} stroke="#c91c23" strokeWidth="3" markerEnd="url(#arrowRed)"/><text x={pnt.x-68} y={pnt.y-10} className="loadLabel">Fx = {fmt(n.fx)} kN</text></>}</g>})}
    {cursor&&<text x="18" y={H-15} className="cursorLabel">X {fmt(cursor.x,2)} m · Y {fmt(cursor.y,2)} m · snap {fmt(snap,2)} m</text>}
    {barStart!==null&&tool==='Barra'&&<text x="18" y="28" className="interactionHint">Barra: selecione o segundo nó</text>}
    {tool==='Nó'&&<text x="18" y="28" className="interactionHint">Nó: toque na grelha para inserir</text>}
    {tool==='Mover'&&<text x="18" y="28" className="interactionHint">Mover: arraste um nó</text>}
    {result&&diagram==='Deformada'&&<text x={W-210} y="28" className="deformLabel">Deformada ampliada ×{fmt(deformScale,1)}</text>}
  </svg>
}

function Diagram({member,kind}:{member:MemberResult;kind:'N'|'V'|'M'}){
  const W=350,H=125,p=22,values=member.samples.map(s=>s[kind]),max=Math.max(1,maxAbs(values))
  const pts=member.samples.map((s,i)=>`${p+(W-2*p)*i/(member.samples.length-1)},${H/2-(s[kind]/max)*(H/2-p)}`).join(' ')
  const unit=kind==='M'?'kNm':'kN',factor=kind==='M'?1e6:1000
  return <div className="diagram"><div><b>{kind}</b><span>máx. |{kind}| = {fmt(max/factor)} {unit}</span></div><svg viewBox={`0 0 ${W} ${H}`}><line x1={p} y1={H/2} x2={W-p} y2={H/2} stroke="#adb6bf"/><polyline points={pts} fill="none" stroke="#a80d19" strokeWidth="3"/></svg></div>
}

function Checks({checks}:{checks:EC2Check[]}){return <div className="checks">{checks.map(c=><div className={`check ${c.status.toLowerCase()}`} key={c.id}><div><b>{c.title}</b><span>{c.note}</span></div><div className="checkvals">{c.demand!==undefined&&<small>{fmt(c.demand)} {c.unit}</small>}<strong>{statusLabel(c.status)}</strong>{c.utilization!==undefined&&Number.isFinite(c.utilization)&&<em>{fmt(c.utilization*100,0)}%</em>}</div></div>)}</div>}

function RebarSection({b,h,cover,bottom,top}:{b:number;h:number;cover:number;bottom?:{phi:number,n:number};top?:{phi:number,n:number}}){
  const W=330,H=280,p=30,s=Math.min((W-2*p)/b,(H-2*p)/h),rw=b*s,rh=h*s,x=(W-rw)/2,y=(H-rh)/2,bn=bottom?.n??4,tn=top?.n??2
  const barLine=(n:number,yy:number,phi:number,keyPrefix:string)=>Array.from({length:n}).map((_,i)=>{const px=x+cover*s+12+i*(rw-2*cover*s-24)/Math.max(1,n-1);return <circle key={`${keyPrefix}-${i}`} cx={px} cy={yy} r={clamp(phi*s/2,4,8)} fill="#14324a"/>})
  return <svg viewBox={`0 0 ${W} ${H}`} className="rebarSketch"><rect x={x} y={y} width={rw} height={rh} fill="#f7f7f7" stroke="#303840" strokeWidth="3"/><rect x={x+cover*s} y={y+cover*s} width={rw-2*cover*s} height={rh-2*cover*s} fill="none" stroke="#a80d19" strokeWidth="3" rx="4"/>{barLine(tn,y+cover*s+14,top?.phi??12,'t')}{barLine(bn,y+rh-cover*s-14,bottom?.phi??16,'b')}<text x={W/2} y={H-5} textAnchor="middle" fontSize="14">Corte · sup. {top?`${top.n}Ø${top.phi}`:'—'} · inf. {bottom?`${bottom.n}Ø${bottom.phi}`:'—'}</text></svg>
}

function BeamElevation({L=6,bottom,top,endSt,midSt,zone=1}:{L?:number;bottom?:{phi:number,n:number};top?:{phi:number,n:number};endSt:string;midSt:string;zone:number}){
  const total=570,ratio=clamp(zone/Math.max(L,0.1),.08,.35),zx=total*ratio
  return <svg viewBox="0 0 680 270" className="rebarSketch"><rect x="55" y="55" width="570" height="120" fill="#f8f8f8" stroke="#303840" strokeWidth="3"/><line x1="75" y1="150" x2="605" y2="150" stroke="#14324a" strokeWidth="5"/><line x1="75" y1="80" x2="605" y2="80" stroke="#14324a" strokeWidth="4"/>{Array.from({length:22}).map((_,i)=><rect key={i} x={73+i*25} y="68" width="16" height="94" fill="none" stroke={i*25<zx||i*25>total-zx?'#a80d19':'#c26b73'} strokeWidth="2"/>)}<path d="M55 185 L75 215 L95 185 Z M585 185 L605 215 L625 185 Z" fill="#c3c8cd" stroke="#14324a"/><text x="340" y="35" textAnchor="middle" fontSize="18" fontWeight="700">ALÇADO ESQUEMÁTICO DA VIGA</text><text x="340" y="145" textAnchor="middle" fontSize="16">Inf. {bottom?`${bottom.n}Ø${bottom.phi}`:'—'}</text><text x="340" y="100" textAnchor="middle" fontSize="16">Sup. {top?`${top.n}Ø${top.phi}`:'—'}</text><text x="170" y="197" textAnchor="middle" fontSize="13">apoios: {endSt}</text><text x="340" y="197" textAnchor="middle" fontSize="13">vão: {midSt}</text><text x="510" y="197" textAnchor="middle" fontSize="13">apoios: {endSt}</text><text x="340" y="228" textAnchor="middle" fontSize="13">zonas de apoio ≈ {fmt(zone,2)} m</text><text x="340" y="250" textAnchor="middle" fontSize="14">L = {fmt(L,2)} m</text></svg>
}

function ColumnSketch({b,h,cover,bars,tieSpacing}:{b:number;h:number;cover:number;bars:{phi:number,n:number};tieSpacing:number}){return <div><RebarSection b={b} h={h} cover={cover} bottom={bars} top={bars}/><svg viewBox="0 0 300 300" className="rebarSketch"><rect x="100" y="25" width="100" height="235" fill="#f8f8f8" stroke="#303840" strokeWidth="3"/>{Array.from({length:12}).map((_,i)=><rect key={i} x="112" y={40+i*17} width="76" height="12" fill="none" stroke="#a80d19" strokeWidth="2"/>)}<line x1="120" y1="35" x2="120" y2="250" stroke="#14324a" strokeWidth="5"/><line x1="180" y1="35" x2="180" y2="250" stroke="#14324a" strokeWidth="5"/><text x="150" y="280" textAnchor="middle" fontSize="13">{bars.n}Ø{bars.phi} · cintas Ø8/{fmt(tieSpacing,0)}</text></svg></div>}

function RebarSchedule({rows}:{rows:RebarRow[]}){
  const total=rows.reduce((s,r)=>s+r.weightKg,0)
  return <div className="card"><b>Mapa de armaduras · estimativa</b><div className="tableWrap"><table><thead><tr><th>Marca</th><th>Descrição</th><th>Ø</th><th>Qtd.</th><th>L/un.</th><th>kg</th></tr></thead><tbody>{rows.map(r=><tr key={r.mark}><td>{r.mark}</td><td>{r.description}</td><td>{r.phi}</td><td>{r.qty}</td><td>{fmt(r.lengthM,2)} m</td><td>{fmt(r.weightKg,1)}</td></tr>)}</tbody><tfoot><tr><td colSpan={5}><b>Total aproximado</b></td><td><b>{fmt(total,1)} kg</b></td></tr></tfoot></table></div></div>
}

export default function App(){
  const [settings,setSettings]=useState<Settings>(()=>{
    try{const raw=localStorage.getItem('rjp-structures-settings-v16');if(raw)return {...DEFAULT_SETTINGS,...JSON.parse(raw)}}catch{}
    return DEFAULT_SETTINGS
  })
  const [mode,setMode]=useState<Mode>(()=>{const saved=localStorage.getItem('rjp-structures-mode-v16') as Mode|null;return saved&&(['Viga','Pórtico 2D','Treliça 2D'] as Mode[]).includes(saved)?saved:'Viga'})
  const [model,setModel]=useState<Model2D>(()=>{
    try{const raw=localStorage.getItem('rjp-structures-model-v16');if(raw)return JSON.parse(raw) as Model2D}catch{}
    return makeModel(mode,settings)
  })
  const [selectedElement,setSelectedElement]=useState<number>(()=>model.elements[0]?.id??1)
  const [selectedNode,setSelectedNode]=useState<number|null>(null)
  const [tab,setTab]=useState<Tab>('Modelo')
  const [tool,setTool]=useState<Tool>('Selecionar')
  const [canvasResult,setCanvasResult]=useState<CanvasResult>('M')
  const [barStart,setBarStart]=useState<number|null>(null)
  const [snap,setSnap]=useState<number>(()=>Number(localStorage.getItem('rjp-structures-snap-v16')||0.25))

  useEffect(()=>{localStorage.setItem('rjp-structures-settings-v16',JSON.stringify(settings))},[settings])
  useEffect(()=>{localStorage.setItem('rjp-structures-mode-v16',mode)},[mode])
  useEffect(()=>{localStorage.setItem('rjp-structures-model-v16',JSON.stringify(model))},[model])
  useEffect(()=>{localStorage.setItem('rjp-structures-snap-v16',String(snap))},[snap])

  function set(k:keyof Settings,v:number|string){
    setSettings(s=>({...s,[k]:v}))
    if(k==='fck'||k==='fyk'||k==='cover'){
      setModel(m=>({...m,elements:m.elements.map(e=>{
        if(!e.section)return e
        const section={...e.section,[k]:Number(v)}
        const E=k==='fck'?concreteProps(Number(v)).Ecm:e.E
        return {...e,E,section}
      })}))
    }
  }
  function changeMode(next:Mode){
    const fresh=makeModel(next,settings);setMode(next);setModel(fresh);setSelectedElement(fresh.elements[0]?.id??1);setSelectedNode(null);setBarStart(null);setTab('Modelo');setTool('Selecionar')
  }
  function selectElement(id:number){setSelectedElement(id);setSelectedNode(null)}
  function selectNode(id:number){setSelectedNode(id)}
  function addNode(x:number,y:number){const id=Math.max(0,...model.nodes.map(n=>n.id))+1;setModel(m=>({...m,nodes:[...m.nodes,{id,x,y}]}));setSelectedNode(id)}
  function makeNewElement(n1:number,n2:number){
    const a=model.nodes.find(n=>n.id===n1),b=model.nodes.find(n=>n.id===n2);if(!a||!b)return
    const id=Math.max(0,...model.elements.map(e=>e.id))+1
    if(mode==='Treliça 2D'){
      setModel(m=>({...m,elements:[...m.elements,{id,n1,n2,E:210000,A:settings.trussA,I:0,kind:'truss'}]}));setSelectedElement(id);setSelectedNode(null);return
    }
    const vertical=Math.abs(b.y-a.y)>Math.abs(b.x-a.x)*1.2
    const bw=vertical?settings.colB:settings.beamB,h=vertical?settings.colH:settings.beamH
    const section={b:bw,h,cover:settings.cover,fck:settings.fck,fyk:settings.fyk}
    setModel(m=>({...m,elements:[...m.elements,{id,n1,n2,E:concreteProps(settings.fck).Ecm,A:bw*h,I:bw*h**3/12,kind:'frame',section}]}));setSelectedElement(id);setSelectedNode(null)
  }
  function barNode(id:number){
    if(barStart===null){setBarStart(id);setSelectedNode(id);return}
    if(barStart===id){setBarStart(null);return}
    const duplicate=model.elements.some(e=>(e.n1===barStart&&e.n2===id)||(e.n1===id&&e.n2===barStart))
    if(!duplicate)makeNewElement(barStart,id)
    setBarStart(null)
  }
  function toggleSupport(id:number){setModel(m=>({...m,nodes:m.nodes.map(n=>{if(n.id!==id)return n;const pinned=n.fixX&&n.fixY&&!n.fixR,roller=!n.fixX&&n.fixY&&!n.fixR,fixed=n.fixX&&n.fixY&&n.fixR;if(!n.fixX&&!n.fixY&&!n.fixR)return {...n,fixX:true,fixY:true,fixR:false};if(pinned)return {...n,fixX:false,fixY:true,fixR:false};if(roller)return {...n,fixX:true,fixY:true,fixR:true};if(fixed)return {...n,fixX:false,fixY:false,fixR:false};return {...n,fixX:false,fixY:false,fixR:false}})}));setSelectedNode(id)}
  function applyNodeLoad(id:number){setModel(m=>({...m,nodes:m.nodes.map(n=>n.id===id?{...n,fy:(n.fy??0)-10}:n)}));setSelectedNode(id);setTab('Cargas')}
  function applyElementLoad(id:number){setModel(m=>({...m,elements:m.elements.map(e=>e.id===id&&e.kind!=='truss'?{...e,qy:(e.qy??0)-5}:e)}));selectElement(id);setTab('Cargas')}
  function deleteElement(id:number){setModel(m=>({...m,elements:m.elements.filter(e=>e.id!==id)}));if(selectedElement===id){const next=model.elements.find(e=>e.id!==id);setSelectedElement(next?.id??1)}setBarStart(null)}
  function deleteNode(id:number){const remaining=model.elements.filter(e=>e.n1!==id&&e.n2!==id);const removesSelected=model.elements.some(e=>e.id===selectedElement&&(e.n1===id||e.n2===id));setModel(m=>({...m,nodes:m.nodes.filter(n=>n.id!==id),elements:m.elements.filter(e=>e.n1!==id&&e.n2!==id)}));if(selectedNode===id)setSelectedNode(null);if(removesSelected)setSelectedElement(remaining[0]?.id??1);setBarStart(null)}
  function moveNode(id:number,x:number,y:number){setModel(m=>({...m,nodes:m.nodes.map(n=>n.id===id?{...n,x,y}:n)}))}
  function updateNode(id:number,patch:Partial<Node2D>){setModel(m=>({...m,nodes:m.nodes.map(n=>n.id===id?{...n,...patch}:n)}))}
  function updateElement(id:number,patch:Partial<Model2D['elements'][number]>){setModel(m=>({...m,elements:m.elements.map(e=>e.id===id?{...e,...patch}:e)}))}
  function updateSectionDimension(key:'b'|'h'|'cover',value:number){
    const e=model.elements.find(x=>x.id===selectedElement);if(!e?.section)return
    const section={...e.section,[key]:value},A=section.b*section.h,I=section.b*section.h**3/12
    updateElement(e.id,{section,A,I})
  }
  function setSupportFromValue(v:string){if(selectedNode===null)return;const patch=v==='fixo'?{fixX:true,fixY:true,fixR:true}:v==='articulado'?{fixX:true,fixY:true,fixR:false}:v==='movel'?{fixX:false,fixY:true,fixR:false}:{fixX:false,fixY:false,fixR:false};updateNode(selectedNode,patch)}
  function supportValue(n:Node2D|undefined){if(!n)return 'livre';if(n.fixX&&n.fixY&&n.fixR)return 'fixo';if(n.fixX&&n.fixY)return 'articulado';if(!n.fixX&&n.fixY)return 'movel';return 'livre'}

  const analysis=useMemo<AnalysisState>(()=>{try{return {ok:true,data:solveFrame(model)}}catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)}}},[model])
  const result=analysis.ok?analysis.data:null
  const analysisError='error' in analysis?analysis.error:''
  const reactionVector=result?.R??[]
  const selected=selectedElement
  const member=result?.members.find(m=>m.id===selected)
  const el=model.elements.find(e=>e.id===selected)
  const selectedNodeObj=selectedNode!==null?model.nodes.find(n=>n.id===selectedNode):undefined
  const n1=model.nodes.find(n=>n.id===el?.n1),n2=model.nodes.find(n=>n.id===el?.n2)
  const critM=criticalSample(member,'M'),critV=criticalSample(member,'V'),critN=criticalSample(member,'N')
  const med=Math.abs(critM.value)/1e6,ved=Math.abs(critV.value)/1000,ned=Math.abs(critN.value)/1000
  const moments=momentExtrema(member)
  const length=n1&&n2?Math.hypot(n2.x-n1.x,n2.y-n1.y):0
  const isTruss=el?.kind==='truss'
  const isColumn=!!(!isTruss&&n1&&n2&&Math.abs(n2.y-n1.y)>Math.abs(n2.x-n1.x)*1.2)
  const sec=el?.section

  const commonBeam=sec&&!isColumn?{...sec,span:length,phiLong:16,phiSt:8,exposure:settings.exposure,structuralClass:4,deltaCdev:10,cotTheta:settings.cotTheta}:null
  const pos0=commonBeam?beamEC2({...commonBeam,MEd:moments.positive,VEd:ved}):null
  const neg0=commonBeam?beamEC2({...commonBeam,MEd:moments.negative,VEd:ved}):null
  const bottomBars=pos0&&sec?chooseBarsEC2(pos0.flex.AsReq,sec.b,sec.cover,8,20)[0]:undefined
  const topBars=neg0&&sec?chooseBarsEC2(neg0.flex.AsReq,sec.b,sec.cover,8,20)[0]:undefined
  const criticalBars=moments.negative>moments.positive?topBars:bottomBars
  const beamBase=commonBeam?beamEC2({...commonBeam,MEd:med,VEd:ved,phiLong:criticalBars?.phi??16,AsProv:criticalBars?.area,phiBars:criticalBars?.phi,nBars:criticalBars?.n}):null
  const stirrupEnd=beamBase?chooseStirrupsEC2(beamBase.shear.AswPerS,beamBase.flex.d)[0]:undefined
  const midV=member?.samples.length?Math.abs(member.samples.reduce((best,s)=>Math.abs(s.x-length/2)<Math.abs(best.x-length/2)?s:best,member.samples[0]).V)/1000:0
  const midBeam=commonBeam&&beamBase?beamEC2({...commonBeam,MEd:med,VEd:midV,phiLong:criticalBars?.phi??16,AsProv:criticalBars?.area,phiBars:criticalBars?.phi,nBars:criticalBars?.n}):null
  const stirrupMid=midBeam?chooseStirrupsEC2(midBeam.shear.AswPerS,midBeam.flex.d)[0]:undefined
  const beamFinal=commonBeam&&beamBase?beamEC2({...commonBeam,MEd:med,VEd:ved,phiLong:criticalBars?.phi??16,phiSt:stirrupEnd?.phi??8,AsProv:criticalBars?.area??beamBase.flex.AsReq,phiBars:criticalBars?.phi??16,nBars:criticalBars?.n??4,AswPerSProv:stirrupEnd?.AswPerS??beamBase.shear.AswPerS,phiStProv:stirrupEnd?.phi??8,stirrupSpacing:stirrupEnd?.spacing??150}):null
  const col0=sec&&isColumn?columnEC2({...sec,NEd:ned,M01:member?Math.abs(member.endForces[2])/1e6:0,M02:member?Math.abs(member.endForces[5])/1e6:0,l0:length,phiLong:16,phiTie:8,tieSpacing:150,creepPhi:2,rm:0,exposure:settings.exposure,deltaCdev:10}):null
  const colCandidates=col0&&sec?chooseColumnBarsEC2(col0.AsMin,sec.b,sec.h,sec.cover,8,20):[]
  const colBars=col0&&sec?(colCandidates.find(b=>columnEC2({...sec,NEd:ned,M01:member?Math.abs(member.endForces[2])/1e6:0,M02:member?Math.abs(member.endForces[5])/1e6:0,l0:length,phiLong:b.phi,phiTie:8,tieSpacing:150,AsProv:b.area,creepPhi:2,rm:0}).interaction<=1)??colCandidates[colCandidates.length-1]):undefined
  const col=sec&&isColumn&&col0?columnEC2({...sec,NEd:ned,M01:member?Math.abs(member.endForces[2])/1e6:0,M02:member?Math.abs(member.endForces[5])/1e6:0,l0:length,phiLong:colBars?.phi??16,phiTie:8,tieSpacing:150,AsProv:colBars?.area??col0.AsMin,creepPhi:2,rm:0,exposure:settings.exposure,deltaCdev:10}):null
  const slab=slabEC2({h:200,cover:settings.cover,fck:settings.fck,fyk:settings.fyk,MEdPerM:35,span:5,phi:12,spacing:150,exposure:settings.exposure})
  const punch=punchingEC2({c1:300,c2:300,h:220,cover:settings.cover,fck:settings.fck,fyk:settings.fyk,VEd:380,rhoL:.006,beta:1.15})
  const footing=footingEC2({B:2.2,L:2.2,h:500,cover:50,colB:.35,colL:.35,NEd:900,fck:settings.fck,fyk:settings.fyk,phi:16})
  const fatigue=fatigueQuickCheck(120)
  const fire=sec?firePrecheck(isColumn?'column':'beam',60,sec.b,sec.h,sec.cover+8+8):null
  const nodeIndex=new Map<number,number>(model.nodes.map((n,i)=>[n.id,i] as [number,number]))
  const checks=beamFinal?.checks??col?.checks??[]
  const ok=checks.filter(c=>c.status==='OK').length,fail=checks.filter(c=>c.status==='FAIL').length,warn=checks.filter(c=>c.status==='WARN').length
  const endStLabel=stirrupEnd?`${stirrupEnd.legs}r Ø${stirrupEnd.phi}/${stirrupEnd.spacing}`:'—'
  const midStLabel=stirrupMid?`${stirrupMid.legs}r Ø${stirrupMid.phi}/${stirrupMid.spacing}`:'—'
  const zone=beamFinal?Math.min(length/4,Math.max(.5,2*beamFinal.flex.d/1000)):0

  const beamSchedule:RebarRow[]=useMemo(()=>{
    if(!beamFinal||!sec||!bottomBars||!topBars||!stirrupEnd||!stirrupMid)return []
    const lLong=length+2*beamFinal.anchorage.lbd/1000,clearB=Math.max(50,sec.b-2*sec.cover),clearH=Math.max(50,sec.h-2*sec.cover),stCut=2*(clearB+clearH)/1000+20*stirrupEnd.phi/1000
    const endCount=Math.max(2,2*(Math.ceil(zone*1000/stirrupEnd.spacing)+1)),midLen=Math.max(0,length-2*zone),midCount=Math.max(0,Math.ceil(midLen*1000/stirrupMid.spacing))
    return [{mark:'B1',description:'Longitudinal inferior',phi:bottomBars.phi,qty:bottomBars.n,lengthM:lLong,weightKg:barWeight(bottomBars.phi,bottomBars.n,lLong)},{mark:'B2',description:'Longitudinal superior',phi:topBars.phi,qty:topBars.n,lengthM:lLong,weightKg:barWeight(topBars.phi,topBars.n,lLong)},{mark:'E1',description:`Estribos zonas de apoio ${endStLabel}`,phi:stirrupEnd.phi,qty:endCount,lengthM:stCut,weightKg:barWeight(stirrupEnd.phi,endCount,stCut)},{mark:'E2',description:`Estribos zona de vão ${midStLabel}`,phi:stirrupMid.phi,qty:midCount,lengthM:stCut,weightKg:barWeight(stirrupMid.phi,midCount,stCut)}]
  },[beamFinal,sec,bottomBars,topBars,stirrupEnd,stirrupMid,length,zone,endStLabel,midStLabel])
  const columnSchedule:RebarRow[]=useMemo(()=>{if(!col||!colBars||!sec)return [];const longLen=length+Math.max(.6,40*colBars.phi/1000),tieCut=2*(Math.max(50,sec.b-2*sec.cover)+Math.max(50,sec.h-2*sec.cover))/1000+20*8/1000,nTies=Math.ceil(length*1000/col.tieSpacing)+1;return [{mark:'P1',description:'Varões longitudinais',phi:colBars.phi,qty:colBars.n,lengthM:longLen,weightKg:barWeight(colBars.phi,colBars.n,longLen)},{mark:'C1',description:`Cintas Ø8/${fmt(col.tieSpacing,0)}`,phi:8,qty:nTies,lengthM:tieCut,weightKg:barWeight(8,nTies,tieCut)}]},[col,colBars,sec,length])

  function saveProject(){localStorage.setItem('rjp-structures-settings-v16',JSON.stringify(settings));localStorage.setItem('rjp-structures-mode-v16',mode);localStorage.setItem('rjp-structures-model-v16',JSON.stringify(model));localStorage.setItem('rjp-structures-snap-v16',String(snap))}
  function exportProject(){const file:ProjectFile={version:'1.6.0',mode,settings,model,snap};const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='RJP_Structures_V1_6_Project.json';a.click();URL.revokeObjectURL(a.href)}
  function importProject(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{const p=JSON.parse(String(reader.result)) as ProjectFile;const nextSettings={...DEFAULT_SETTINGS,...(p.settings??{})};const nextMode=p.mode??'Viga';const nextModel=p.model??makeModel(nextMode,nextSettings);setSettings(nextSettings);setMode(nextMode);setModel(nextModel);setSnap(p.snap??.25);setSelectedElement(nextModel.elements[0]?.id??1);setSelectedNode(null);setBarStart(null)}catch{alert('Ficheiro de projeto inválido.')}};reader.readAsText(f);e.target.value=''}
  function resetProject(){const fresh=makeModel('Viga',DEFAULT_SETTINGS);setSettings(DEFAULT_SETTINGS);setMode('Viga');setModel(fresh);setSelectedElement(fresh.elements[0]?.id??1);setSelectedNode(null);setBarStart(null);setTab('Modelo');setTool('Selecionar')}
  function resetTemplate(){const fresh=makeModel(mode,settings);setModel(fresh);setSelectedElement(fresh.elements[0]?.id??1);setSelectedNode(null);setBarStart(null)}

  const toolIcons:Record<Tool,string>={Selecionar:'↖',Nó:'○',Barra:'╱',Apoio:'△',Carga:'↓',Mover:'✥',Apagar:'⌫'}
  const bottomTabs:{tab:Tab;icon:string;label:string}[]=[{tab:'Modelo',icon:'◇',label:'Modelo'},{tab:'Cargas',icon:'↓',label:'Cargas'},{tab:'Resultados',icon:'▥',label:'Resultados'},{tab:'EC2',icon:'EC2',label:'EC2'},{tab:'Pormenorização',icon:'▦',label:'Pormenorização'},{tab:'Relatório',icon:'▤',label:'Relatório'},{tab:'Definições',icon:'⚙',label:'Definições'}]
  const selectedTitle=selectedNodeObj?`Nó N${selectedNodeObj.id}`:el?`${isTruss?'Barra de treliça':isColumn?'Pilar':'Viga'} B${el.id}`:'Sem seleção'

  return <div className="app mockupApp">
    <header className="topHeader">
      <div className="brandBlock"><img src="./icons/ic_launcher.png" alt="RJP Structures"/><div><b>RJP Structures</b><span>ANALISAR · DIMENSIONAR · PORMENORIZAR</span></div></div>
      <div className="topActions"><button onClick={resetProject}><span>＋</span>Novo</button><label className="topFileAction"><span>↥</span>Abrir<input type="file" accept="application/json" onChange={importProject}/></label><button onClick={saveProject}><span>▣</span>Guardar</button><button onClick={()=>setTab('Resultados')}><span>∑</span>Calcular</button><button onClick={()=>setTab('Relatório')}><span>▤</span>Relatório</button></div>
    </header>
    <div className="modelStrip"><div className="modelSelect"><span>Tipo de modelo</span><select value={mode} onChange={(e:ChangeEvent<HTMLSelectElement>)=>changeMode(e.target.value as Mode)}>{(['Viga','Pórtico 2D','Treliça 2D'] as Mode[]).map(m=><option key={m}>{m}</option>)}</select></div><div className="projectTitle"><strong>Editor estrutural interativo</strong><span>EC2 · MEF 2D · PT-PT · snap {fmt(snap,2)} m</span></div><div className="versionPill">V1.6</div></div>
    <main className="studioLayout">
      <aside className="leftToolbar" aria-label="Ferramentas de desenho">{(['Selecionar','Nó','Barra','Apoio','Carga','Mover','Apagar'] as Tool[]).map(t=><button key={t} className={tool===t?'active':''} onClick={()=>{setTool(t);if(t!=='Barra')setBarStart(null)}} title={t}><span className="toolIcon">{toolIcons[t]}</span><small>{t}</small></button>)}</aside>
      <section className="workspace mockupWorkspace">
        <div className="canvasHeader"><div><strong>{mode}</strong><span> · {selectedTitle}</span></div><div className="resultSwitch">{(['N','V','M','Deformada'] as CanvasResult[]).map(r=><button key={r} className={canvasResult===r?'active':''} onClick={()=>setCanvasResult(r)}>{r}</button>)}</div></div>
        <ModelView model={model} result={result} selectedElement={selectedElement} selectedNode={selectedNode} tool={tool} barStart={barStart} snap={snap} diagram={canvasResult} onSelectElement={selectElement} onSelectNode={selectNode} onAddNode={addNode} onBarNode={barNode} onToggleSupport={toggleSupport} onApplyNodeLoad={applyNodeLoad} onApplyElementLoad={applyElementLoad} onDeleteElement={deleteElement} onDeleteNode={deleteNode} onMoveNode={moveNode}/>
        <div className="canvasStatus"><span><b>Ferramenta:</b> {tool}</span><span><b>Nós:</b> {model.nodes.length}</span><span><b>Barras:</b> {model.elements.length}</span><span><b>Snap:</b> {fmt(snap,2)} m</span><span><b>Cálculo:</b> {analysis.ok?'atualizado':'modelo instável/incompleto'}</span>{barStart!==null&&<span><b>Barra:</b> N{barStart} → selecione outro nó</span>}</div>
        <div className="quickResults"><div><span>MEd</span><b>{isTruss?'—':`${fmt(med)} kNm`}</b></div><div><span>VEd</span><b>{isTruss?'—':`${fmt(ved)} kN`}</b></div><div><span>NEd</span><b>{`${fmt(ned)} kN`}</b></div><div><span>As,inf</span><b>{bottomBars?`${fmt(bottomBars.area,0)} mm²`:'—'}</b></div><div><span>As,sup</span><b>{topBars?`${fmt(topBars.area,0)} mm²`:'—'}</b></div><div><span>Estribos</span><b>{beamFinal?endStLabel:'—'}</b></div><div><span>Fissuração</span><b className={beamFinal?.checks.some(c=>c.id.includes('crack')&&c.status==='FAIL')?'bad':'good'}>{beamFinal?`${fmt(beamFinal.crack.wk,3)} mm`:'—'}</b></div><div><span>Estado</span><b className={fail?'bad':'good'}>{checks.length?(fail?'VERIFICAR':'CUMPRE'):'—'}</b></div></div>
      </section>
      <aside className="propertiesPanel">
        <div className="panelTitle"><div><h2>Propriedades</h2><span>{selectedTitle}</span></div><span className="collapseMark">⌃</span></div>
        <div className="selectedSummary">{selectedNodeObj?<><div><span>Coordenada X</span><b>{fmt(selectedNodeObj.x)} m</b></div><div><span>Coordenada Y</span><b>{fmt(selectedNodeObj.y)} m</b></div></>:<><div><span>Comprimento</span><b>{fmt(length)} m</b></div><div><span>Secção</span><b>{sec?`${sec.b} × ${sec.h} mm`:`A = ${fmt(el?.A,0)} mm²`}</b></div></>}</div>

        {tab==='Modelo'&&<><h3>Editor do elemento</h3>{selectedNodeObj?<div className="fields singleColumn"><NumInput label="Coordenada X" value={selectedNodeObj.x} onChange={v=>updateNode(selectedNodeObj.id,{x:v})} unit="m" step={snap}/><NumInput label="Coordenada Y" value={selectedNodeObj.y} onChange={v=>updateNode(selectedNodeObj.id,{y:v})} unit="m" step={snap}/><label className="field"><span>Tipo de apoio</span><select value={supportValue(selectedNodeObj)} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setSupportFromValue(e.target.value)}><option value="livre">Livre</option><option value="articulado">Articulado</option><option value="movel">Móvel</option><option value="fixo">Encastre</option></select></label></div>:el?<div className="fields singleColumn"><div className="card compact"><b>Conectividade</b><p>N{el.n1} → N{el.n2} · {el.kind==='truss'?'barra axial':'elemento de pórtico'}</p></div><NumInput label="Módulo E" value={el.E} onChange={v=>updateElement(el.id,{E:v})} unit="MPa" step={1000} min={1}/>{el.kind==='truss'?<NumInput label="Área A" value={el.A} onChange={v=>updateElement(el.id,{A:v})} unit="mm²" step={100} min={1}/>:sec&&<><NumInput label="Largura b" value={sec.b} onChange={v=>updateSectionDimension('b',v)} unit="mm" step={10} min={80}/><NumInput label="Altura h" value={sec.h} onChange={v=>updateSectionDimension('h',v)} unit="mm" step={10} min={100}/><NumInput label="Recobrimento" value={sec.cover} onChange={v=>updateSectionDimension('cover',v)} unit="mm" step={5} min={10}/></>}</div>:<div className="card">Selecione um nó ou uma barra.</div>}<div className="card info compact"><b>Edição gráfica V1.6</b><p><b>Nó:</b> toque na grelha. <b>Barra:</b> escolha dois nós. <b>Apoio:</b> toque num nó para alternar. <b>Carga:</b> toque num nó ou barra. <b>Mover:</b> arraste nós. <b>Apagar:</b> toque no elemento.</p></div><button className="wideSecondary" onClick={resetTemplate}>Gerar novamente o modelo base</button></>}

        {tab==='Cargas'&&<><h3>Ações aplicadas</h3>{selectedNodeObj?<div className="fields singleColumn"><NumInput label="Força horizontal Fx" value={selectedNodeObj.fx??0} onChange={v=>updateNode(selectedNodeObj.id,{fx:v})} unit="kN" step={1}/><NumInput label="Força vertical Fy" value={selectedNodeObj.fy??0} onChange={v=>updateNode(selectedNodeObj.id,{fy:v})} unit="kN" step={1}/><NumInput label="Momento Mz" value={selectedNodeObj.mz??0} onChange={v=>updateNode(selectedNodeObj.id,{mz:v})} unit="kNm" step={1}/><button className="wideSecondary" onClick={()=>updateNode(selectedNodeObj.id,{fx:0,fy:0,mz:0})}>Limpar cargas nodais</button></div>:el?<div className="fields singleColumn">{el.kind==='truss'?<div className="card compact">Nas barras de treliça são consideradas cargas nodais.</div>:<><NumInput label="Carga distribuída local q" value={el.qy??0} onChange={v=>updateElement(el.id,{qy:v})} unit="kN/m" step={.5}/><button className="wideSecondary" onClick={()=>updateElement(el.id,{qy:0})}>Limpar carga distribuída</button></>}</div>:<div className="card">Selecione um nó ou barra.</div>}<div className="card compact"><b>Convenção</b><p>Fx positivo para +X, Fy positivo para +Y. Para gravidade utilize valores negativos em Fy e q.</p></div></>}

        {tab==='Resultados'&&<><h3>Resultados MEF</h3>{!analysis.ok?<div className="card danger">{analysisError}</div>:member?<><div className="card compact"><b>B{selected} · valores críticos</b><p>|N|max = {fmt(ned)} kN em x≈{fmt(critN.x)} m</p>{!isTruss&&<><p>|V|max = {fmt(ved)} kN em x≈{fmt(critV.x)} m</p><p>|M|max = {fmt(med)} kNm em x≈{fmt(critM.x)} m</p></>}</div><Diagram member={member} kind="N"/>{!isTruss&&<><Diagram member={member} kind="V"/><Diagram member={member} kind="M"/></>}<div className="card compact"><b>Reações de apoio</b>{model.nodes.map(n=>{const i=nodeIndex.get(n.id)!;return <p key={n.id}>N{n.id}: Rx {fmt(reactionVector[3*i]/1000)} · Ry {fmt(reactionVector[3*i+1]/1000)} kN · Mz {fmt(reactionVector[3*i+2]/1e6)} kNm</p>})}</div></>:<div className="card">Selecione uma barra.</div>}</>}

        {tab==='EC2'&&<><h3>Verificações EC2</h3>{sec?<><div className="summary"><span className="ok">{ok} cumpre</span><span className="fail">{fail} não cumpre</span><span className="warn">{warn} verificar</span></div>{beamFinal&&<><div className="card compact"><b>Dimensionamento da viga</b><p>M+ = {fmt(moments.positive)} · M− = {fmt(moments.negative)} kNm</p><p>Inferior: {bottomBars?`${bottomBars.n}Ø${bottomBars.phi} = ${fmt(bottomBars.area,0)} mm²`:'—'}</p><p>Superior: {topBars?`${topBars.n}Ø${topBars.phi} = ${fmt(topBars.area,0)} mm²`:'—'}</p><p>Estribos apoio: {endStLabel}</p><p>Estribos vão: {midStLabel}</p><p>wk = {fmt(beamFinal.crack.wk,3)} mm · δ = {fmt(beamFinal.deflection.delta,2)} mm</p><p>lbd = {fmt(beamFinal.anchorage.lbd,0)} mm · l0 = {fmt(beamFinal.anchorage.l0,0)} mm</p></div><Checks checks={beamFinal.checks}/></>}{col&&<><div className="card compact"><b>Dimensionamento do pilar</b><p>NEd = {fmt(ned)} kN · MEd = {fmt(col.MEd)} kNm</p><p>Armadura: {colBars?`${colBars.n}Ø${colBars.phi} = ${fmt(colBars.area,0)} mm²`:'—'}</p><p>λ = {fmt(col.lambda,1)} · λlim = {fmt(col.lambdaLim,1)}</p><p>Interação N-M = {fmt(col.interaction*100,0)}%</p><p>Cintas: Ø8/{fmt(col.tieSpacing,0)} mm</p></div><Checks checks={col.checks}/></>}</>:<div className="card">O EC2 aplica-se aos elementos de betão armado.</div>}<details className="ec2Modules"><summary>Módulos adicionais EC2</summary><div className="card compact"><b>Laje · faixa de 1 m</b><p>As,req = {fmt(slab.flex.AsReq,0)} mm²/m · wk = {fmt(slab.crack.wk,3)} mm</p></div><div className="card compact"><b>Punçoamento</b><p>u1 = {fmt(punch.u1,0)} mm · vEd = {fmt(punch.vEd,3)} MPa · vRd,c = {fmt(punch.vRdc,3)} MPa</p></div><div className="card compact"><b>Sapata isolada</b><p>qEd = {fmt(footing.qEd,1)} kN/m² · Mx = {fmt(footing.Mx,1)} kNm · My = {fmt(footing.My,1)} kNm</p></div><div className="card compact"><b>Fadiga e incêndio</b><p>Fadiga: {statusLabel(fatigue.checks[0].status)}</p><p>Incêndio R60: {fire?statusLabel(fire.check.status):'—'}</p></div></details></>}

        {tab==='Pormenorização'&&<><h3>Peça desenhada</h3>{sec&&beamFinal&&!isColumn&&bottomBars&&topBars?<><BeamElevation L={length} bottom={bottomBars} top={topBars} endSt={endStLabel} midSt={midStLabel} zone={zone}/><RebarSection b={sec.b} h={sec.h} cover={sec.cover} bottom={bottomBars} top={topBars}/><div className="card compact"><p><b>Inferior:</b> {bottomBars.n}Ø{bottomBars.phi}</p><p><b>Superior:</b> {topBars.n}Ø{topBars.phi}</p><p><b>Estribos:</b> {endStLabel} nos apoios; {midStLabel} no vão</p><p><b>Recobrimento:</b> {sec.cover} mm</p></div><RebarSchedule rows={beamSchedule}/></>:sec&&col&&colBars?<><ColumnSketch b={sec.b} h={sec.h} cover={sec.cover} bars={{phi:colBars.phi,n:colBars.n}} tieSpacing={col.tieSpacing}/><div className="card compact"><p><b>Longitudinal:</b> {colBars.n}Ø{colBars.phi} = {fmt(colBars.area,0)} mm²</p><p><b>Cintas:</b> Ø8/{fmt(col.tieSpacing,0)} mm</p><p><b>2.ª ordem:</b> {col.secondOrderRequired?'considerada':'dispensada pelo critério de esbelteza'}</p></div><RebarSchedule rows={columnSchedule}/></>:<div className="card">Pormenorização automática disponível para peças de betão.</div>}</>}

        {tab==='Relatório'&&<><h3>Relatório de cálculo</h3><div className="card report"><b>RJP Structures · {el?`Elemento B${selected}`:'Projeto'}</b><p>Modelo: {mode} · Nós: {model.nodes.length} · Barras: {model.elements.length}</p><p>Tipo: {isTruss?'Treliça':isColumn?'Pilar':'Viga'}</p><p>Materiais: {sec?`C${sec.fck} · aço ${sec.fyk} MPa · exposição ${settings.exposure}`:'barra axial'}</p><hr/>{checks.length?checks.map(c=><p key={c.id}><b>{c.title}:</b> {statusLabel(c.status)} {c.utilization!==undefined&&Number.isFinite(c.utilization)?`(${fmt(c.utilization*100,0)}%)`:''}</p>):<p>Sem verificações EC2 para este elemento.</p>}<button className="printBtn" onClick={()=>window.print()}>Imprimir / Guardar como PDF</button></div><div className="card warning"><b>Validação do projeto</b><p>Confirmar edição do EC2, Anexo Nacional, combinações, classe estrutural, exposição e hipóteses adotadas antes da utilização em projeto de execução.</p></div></>}

        {tab==='Definições'&&<><h3>Materiais e durabilidade</h3><div className="fields singleColumn"><NumInput label="Resistência característica do betão fck" value={settings.fck} onChange={v=>set('fck',v)} unit="MPa" min={12}/><NumInput label="Tensão de cedência do aço fyk" value={settings.fyk} onChange={v=>set('fyk',v)} unit="MPa" min={200}/><NumInput label="Recobrimento predefinido" value={settings.cover} onChange={v=>set('cover',v)} unit="mm" min={10}/><NumInput label="cot θ" value={settings.cotTheta} onChange={v=>set('cotTheta',clamp(v,1,2.5))} step={0.1} min={1}/><label className="field"><span>Classe de exposição</span><select value={settings.exposure} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setSettings(s=>({...s,exposure:e.target.value as ExposureClass}))}>{(['X0','XC1','XC2','XC3','XC4','XD1','XD2','XD3','XS1','XS2','XS3'] as ExposureClass[]).map(x=><option key={x}>{x}</option>)}</select></label><NumInput label="Snap da grelha" value={snap} onChange={v=>setSnap(clamp(v,.05,2))} unit="m" step={.05} min={.05}/></div><h3>Projeto</h3><div className="projectActions"><button onClick={saveProject}>Guardar localmente</button><button onClick={exportProject}>Exportar projeto JSON</button><label className="fileBtn">Importar projeto JSON<input type="file" accept="application/json" onChange={importProject}/></label><button className="secondary" onClick={resetProject}>Repor exemplo</button></div></>}
      </aside>
    </main>
    <nav className="bottomNav">{bottomTabs.map(x=><button key={x.tab} className={tab===x.tab?'active':''} onClick={()=>setTab(x.tab)}><span>{x.icon}</span><small>{x.label}</small></button>)}</nav>
    <footer>RJP Structures V1.6 · editor estrutural interativo · interface PT-PT · MEF 2D · Betão Armado EC2</footer>
  </div>
}
