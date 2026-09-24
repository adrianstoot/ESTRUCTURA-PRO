import { SERIES_LIST, getSizes } from '../entities/ProfileCatalog.js';
import { escapeHTML as esc, categoryOf, finitePositive, mm, validatePolygon, validateHolesInContour } from '../core/WorkshopGeometry.js';
const fmt=n=>Number(n).toLocaleString('es-ES',{maximumFractionDigits:2});
export class PropertiesPanel {
  constructor(panel,drawer){this.panel=panel;this.drawer=drawer;this.activeTab='geometry';this.update(null);}
  setActiveTab(){this.activeTab='geometry';}
  refresh(){this.update(this.selected);}
  update(element){
    this.selected=element;
    this.panel.innerHTML=`<header class="workshop-inspector-head"><span>PROPIEDADES</span><small>mm</small></header><div class="workshop-inspector-body">${element?this.body(element):'<div class="workshop-empty"><span>⌖</span><h3>Tu taller, pieza a pieza</h3><p>Elige un perfil o una chapa. Define sus medidas y colócalo en el modelo.</p><small>Rueda · zoom al cursor<br>Doble clic · centro de giro<br>F · enfocar selección<br>Inicio · encuadrar todo</small></div>'}</div>`;
    if(element)this.wire(element);
  }
  input(key,label,value,{positive=false,unit='mm',step=1}={}){return `<label class="prop-row"><span>${label}</span><span class="input-unit"><input id="prop-${key}" type="number" value="${Number(Number(value).toFixed(3))}" step="${step}" ${positive?'min="0.1"':''} required><em>${unit}</em></span></label>`;}
  select(key,label,options,value){return `<label class="prop-row"><span>${label}</span><select id="prop-${key}">${options.map(o=>`<option value="${esc(o)}" ${String(o)===String(value)?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;}
  block(label,html){return `<details class="prop-accordion" open><summary>${label}</summary><div class="prop-rows">${html}</div></details>`;}
  body(e){
    const p=e.params, eng=e.engineeringData;let html=`<div class="workshop-object"><small>${esc(categoryOf(e).toUpperCase())} · ${esc(e.id)}</small><h2>${esc(p.role||e.designation)}</h2><p>${esc(e.designation)} · ${esc(e.steelGrade)}</p></div>`;
    html+=this.block('Identidad',`<label class="prop-row"><span>Nombre / función</span><input id="prop-role" maxlength="100" value="${esc(p.role||'')}"></label>${this.select('grade','Acero',['S235 JR','S275 JR','S355 JR'],e.steelGrade)}`);
    let dims='';
    if(e.type==='profile')dims=`${this.select('series','Serie',SERIES_LIST,p.series)}${this.select('size','Sección',getSizes(p.series),p.size)}${this.input('length','Longitud de corte',p.length*1000,{positive:true})}${this.input('roll','Giro de sección',p.sectionRotation||0,{unit:'°',step:.1})}${this.input('gauge','Gramil editable',p.gaugeMm||0)}${eng?`<div class="workshop-facts">h ${eng.h} · b ${eng.b} · alma ${eng.tw} · ala ${eng.tf} mm</div>`:''}`;
    if(e.type==='plate')dims=`${this.input('width','Ancho',p.width*1000,{positive:true})}${this.input('height','Alto',p.height*1000,{positive:true})}${this.input('thickness','Espesor',p.thickness*1000,{positive:true,step:.1})}${p.points?`<label class="workshop-full">Contorno X,Y (mm) · un vértice por línea<textarea id="prop-points" rows="5">${p.points.map(v=>`${v.x*1000}, ${v.y*1000}`).join('\n')}</textarea></label>`:''}<div class="workshop-facts">${p.holes?.length||0} taladros · ${fmt(e.area*100)} mm²</div>`;
    if(e.type==='reinforcement')dims=`${this.input('diameter','Diámetro',p.diameterMm,{positive:true,step:.1})}${this.input('length','Longitud',p.length*1000,{positive:true})}<div class="workshop-facts">${p.points?'La longitud escala el trazado completo.':'Barra recta: eje local Z.'}</div>`;
    if(e.type==='fastener')dims=`${this.select('metric','Métrica',['M12','M16','M20','M24','M27','M30'],p.metric)}${this.select('bolt-class','Clase',['8.8','10.9'],p.boltClass||'8.8')}${this.input('shank','Vástago',p.shankLength||60,{positive:true})}`;
    if(e.type==='weld')dims=`${this.select('throat','Garganta a (mm)',[4,5,6,8],(p.throat||p.radius)*1000)}<div class="workshop-facts">Longitud ${fmt(e.pointA.distanceTo(e.pointB)*1000)} mm<br>${e.bindings?.a?'Vinculada a piezas':'Coordenadas globales'}</div>`;
    html+=this.block('Geometría de fabricación',`${dims}<button class="prop-apply-btn" id="apply-geometry">Aplicar geometría</button>`);
    const pos=e.getPosition(), rot=e.getRotation();
    html+=this.block('Posición · centro de pieza',`<div class="workshop-triplet">${['x','y','z'].map(a=>this.input(a,a.toUpperCase(),pos[a]*1000)).join('')}</div><div class="workshop-triplet">${['x','y','z'].map(a=>this.input('r'+a,'R'+a.toUpperCase(),rot[a]*180/Math.PI,{unit:'°',step:.1})).join('')}</div><button class="prop-apply-btn" id="apply-transform">Aplicar posición</button>`);
    html+=`<div class="workshop-error" role="alert"></div><label class="prop-row"><span>Color plano</span><input id="prop-color" type="color" value="${esc(e.color)}"></label>`;
    if(e.type==='profile')html+='<button class="secondary-wide" id="intelligent-join">Unión inteligente</button>';
    if(p.assemblyId)html+='<button class="secondary-wide" id="btn-explode-assembly">Despiece / recomponer</button>';
    const clashes=this.getClashes?.(e)||[];
    if(clashes.length)html+=`<div class="workshop-notice">${clashes.length} candidatos a interferencia con esta pieza. Revise los contactos del conjunto.</div>`;
    if(p.geometryProvenance)html+=`<div class="workshop-notice">${esc(p.geometryProvenance)}</div>`;
    if(p.provenance)html+=`<div class="workshop-notice">${esc(p.provenance)}</div>`;
    html+='<div class="prop-actions-row"><button id="btn-duplicate-element">Duplicar</button><button id="btn-delete-element" class="danger">Eliminar</button></div>';
    return html;
  }
  wire(e){
    const get=k=>this.panel.querySelector('#prop-'+k)?.value;
    const number=k=>{const raw=get(k);if(raw==null||raw.trim()===''||!Number.isFinite(Number(raw)))throw new Error('Complete el campo '+k+'.');return Number(raw);};
    const change=fn=>{try{fn();this.onPropertyChange?.(e,{rebuild:true});this.update(e);}catch(err){this.panel.querySelector('.workshop-error').textContent=err.message;}};
    this.panel.querySelector('#prop-series')?.addEventListener('change',()=>{this.panel.querySelector('#prop-size').innerHTML=getSizes(get('series')).map(v=>`<option>${v}</option>`).join('');});
    this.panel.querySelector('#apply-geometry').onclick=()=>change(()=>{
      const p={...e.params,role:get('role')};
      if(e.type==='profile')Object.assign(p,{series:get('series'),size:get('size'),length:mm(finitePositive(number('length'))),sectionRotation:number('roll'),gaugeMm:number('gauge')});
      if(e.type==='plate'){
        Object.assign(p,{width:mm(finitePositive(number('width'))),height:mm(finitePositive(number('height'))),thickness:mm(finitePositive(number('thickness')))});
        if(p.points){const previousText=e.params.points.map(v=>`${v.x*1000}, ${v.y*1000}`).join('\n');const edited=get('points').trim()!==previousText.trim();const sx=p.width/e.params.width,sy=p.height/e.params.height;p.points=validatePolygon(get('points').trim().split(/\n+/).map(line=>{const v=line.split(',').map(Number);if(v.length!==2)throw new Error('Cada vértice necesita X, Y.');return{x:mm(v[0])*(edited?1:sx),y:mm(v[1])*(edited?1:sy)};}));const xs=p.points.map(v=>v.x),ys=p.points.map(v=>v.y);p.width=Math.max(...xs)-Math.min(...xs);p.height=Math.max(...ys)-Math.min(...ys);}
      }
      if(e.type==='reinforcement'){p.diameterMm=finitePositive(number('diameter'));p.length=mm(finitePositive(number('length')));if(p.points){const factor=p.length/e.params.length;p.points=p.points.map(v=>v.map(n=>n*factor));}}
      if(e.type==='fastener')Object.assign(p,{metric:get('metric'),shankLength:finitePositive(number('shank')),boltClass:get('bolt-class')});
      if(e.type==='weld')Object.assign(p,{radius:mm(number('throat')),throat:mm(number('throat'))});
      if(e.type==='plate'&&p.holes?.some(h=>!h.points)){const contour=p.points||[{x:-p.width/2,y:-p.height/2},{x:p.width/2,y:-p.height/2},{x:p.width/2,y:p.height/2},{x:-p.width/2,y:p.height/2}];validateHolesInContour(contour,p.holes.filter(h=>!h.points),.5);}
      e.steelGrade=get('grade');e.update(p);
    });
    this.panel.querySelector('#apply-transform').onclick=()=>change(()=>{e.setPosition(...['x','y','z'].map(a=>mm(number(a))));e.setRotation(...['rx','ry','rz'].map(number));e.mesh.updateMatrixWorld(true);});
    this.panel.querySelector('#prop-color').onchange=ev=>{e.setColor(ev.target.value);this.onColorChange?.(e,ev.target.value);};
    this.panel.querySelector('#btn-delete-element').onclick=()=>this.onDelete?.(e);
    this.panel.querySelector('#btn-duplicate-element').onclick=()=>this.onDuplicate?.(e);
    this.panel.querySelector('#btn-explode-assembly')?.addEventListener('click',()=>this.onExplode?.(e));
    this.panel.querySelector('#intelligent-join')?.addEventListener('click',()=>this.onSmartJoin?.(e));
  }
  updateCoords(e){if(!e)return;for(const a of ['x','y','z']){const input=this.panel.querySelector('#prop-'+a);if(input&&document.activeElement!==input)input.value=(e.getPosition()[a]*1000).toFixed(2);}}
}
