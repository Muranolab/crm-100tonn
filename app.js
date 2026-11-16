'use strict';
(function(){
var $=function(s,r){return (r||document).querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var RU2LAT={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya','ә':'a','і':'i','ң':'n','ғ':'g','ү':'u','ұ':'u','қ':'k','ө':'o','һ':'h'};
var LAT2RU=[['shch','щ'],['yo','ё'],['yu','ю'],['ya','я'],['zh','ж'],['kh','х'],['ts','ц'],['ch','ч'],['sh','ш'],['ju','ю'],['ja','я'],['jo','ё'],['iu','ю'],['ia','я']];
function toLat(s){return String(s||'').toLowerCase().replace(/[а-яёәіңғүұқөһ]/g,function(c){return RU2LAT[c]!==undefined?RU2LAT[c]:c})}
function toCyr(s){s=String(s||'').toLowerCase();for(var i=0;i<LAT2RU.length;i++)s=s.split(LAT2RU[i][0]).join(LAT2RU[i][1]);var M={a:'а',b:'б',v:'в',g:'г',d:'д',e:'е',z:'з',i:'и',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',r:'р',s:'с',t:'т',u:'у',f:'ф',y:'й',c:'к',h:'х',w:'в',j:'ж',q:'к',x:'кс'};return s.replace(/[a-z]/g,function(c){return M[c]||c})}
function latNorm(s){s=String(s||'').toLowerCase();s=s.replace(/skiy|skii|skij|sky/g,'ski');s=s.replace(/iy/g,'y');s=s.replace(/kh/g,'h');return s}
function stripLegal(s){return String(s||'').toLowerCase().replace(/[«»""''`]/g,' ').replace(/\b(тоо|ао|ооо|оао|зао|llp|llc|jsc|inc|ltd|plc|ao|too|group|группа|компания|холдинг)\b/g,' ').replace(/\s+/g,' ').trim()}
function fold(s){s=String(s==null?'':s);var a=stripLegal(s),lat=latNorm(toLat(a)),cyr=toCyr(a),dig=s.replace(/\D/g,'');if(/^8\d{10}$/.test(dig))dig='7'+dig.slice(1);return [a,lat,cyr,dig].filter(Boolean).join(' ')}
function matchQ(hay,q){q=String(q||'').trim();if(!q)return true;return q.toLowerCase().split(/\s+/).every(function(w){if(!w)return true;var vars={},list=fold(w).split(/\s+/);list.push(w.toLowerCase());list.forEach(function(v){if(v)vars[v]=1});return Object.keys(vars).some(function(v){return hay.indexOf(v)>=0})})}

function coRu(c){return (c&&(c.nm_ru||c.nm))||''}
function coEn(c){return (c&&c.nm_en)||''}
function coTitleHtml(c){var ru=coRu(c),en=coEn(c);var h=esc(ru);if(en&&en!==ru)h+='<span class="en">'+esc(en)+'</span>';return h}

var B=null; // decrypted bundle
var IX={}; // indexes
var TABS=[['deals','Сделки','\u{1F4BC}'],['co','Компании','\u{1F3E2}'],['si','Площадки','\u{1F4CD}'],['au','Аудиты','\u{1F4CB}'],['pp','ЛПР','\u{1F464}'],['le','Письма','\u2709\uFE0F'],['team','Команда','\u{1F465}']];
var VERSION='9b74189a';
// ---------- base64 / crypto ----------
function b64d(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function idb(){return new Promise(function(res,rej){var r=indexedDB.open('crm100',1);r.onupgradeneeded=function(){r.result.createObjectStore('k')};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
function idbGet(k){return idb().then(function(db){return new Promise(function(res,rej){var q=db.transaction('k').objectStore('k').get(k);q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}})})}
function idbSet(k,v){return idb().then(function(db){return new Promise(function(res,rej){var t=db.transaction('k','readwrite');t.objectStore('k').put(v,k);t.oncomplete=res;t.onerror=function(){rej(t.error)}})})}
function idbDel(k){return idb().then(function(db){return new Promise(function(res){var t=db.transaction('k','readwrite');t.objectStore('k').delete(k);t.oncomplete=res})})}
function deriveKey(pass,hdr){
  var enc=new TextEncoder();
  return crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']).then(function(km){
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(hdr.s),iterations:hdr.it,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['decrypt'])})}
function decryptWith(key,hdr){
  return crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(hdr.iv)},key,b64d(hdr.ct)).then(function(buf){
    if(!hdr.gz)return buf;
    var ds=new DecompressionStream('gzip');var w=ds.writable.getWriter();w.write(buf);w.close();
    return new Response(ds.readable).arrayBuffer()}).then(function(buf){return JSON.parse(new TextDecoder().decode(buf))})}
function fetchEnc(){return fetch('data.enc',{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.json()})}
// ---------- local state ----------
var LS={ed:{},deals:[],ex:false};
function lsLoad(){try{var x=JSON.parse(localStorage.getItem('crm100')||'null');if(x){LS.ed=x.ed||{};LS.deals=x.deals||[];LS.ex=!!x.ex}}catch(e){}}
function lsSave(){localStorage.setItem('crm100',JSON.stringify(LS))}
function ed(k){return LS.ed[k]||{}}
function setEd(k,patch){var o=LS.ed[k]||{};for(var p in patch)o[p]=patch[p];o.ts=Date.now();if(!o.st&&!o.nt)delete LS.ed[k];else LS.ed[k]=o;lsSave()}
function toast(t){var e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){e.hidden=true},2200)}
// ---------- indexes ----------
function buildIndex(){
  IX.co={};B.co.forEach(function(c){IX.co[c.id]=c});
  IX.ppBy={},IX.siBy={},IX.auBy={},IX.leBy={},IX.dBy={};
  function push(m,k,v){(m[k]=m[k]||[]).push(v)}
  B.pp.forEach(function(p){push(IX.ppBy,p.cid,p)});
  B.si.forEach(function(s){push(IX.siBy,s.cid,s)});
  B.au.forEach(function(a){push(IX.auBy,a.cid,a)});
  B.le.forEach(function(l){push(IX.leBy,l.cid,l)});
  B.deals.forEach(function(d){push(IX.dBy,d.cid,d)});
  var rk={'решает':0,'закупки':1,'влияет':2,'союзник':3,'площадка':4},ck={'подтверждён':0,'вероятно':1,'возможно':2,'низкая':3,'':4};
  for(var k in IX.ppBy)IX.ppBy[k].sort(function(a,b){return (rk[a.r]==null?5:rk[a.r])-(rk[b.r]==null?5:rk[b.r])||(ck[a.c]-ck[b.c])||((b.e.length+b.t.length>0)-(a.e.length+a.t.length>0))});
  function hay(o,f){var parts=f.map(function(x){var v=o[x];return Array.isArray(v)?v.join(' '): (v||'')});if(o.al)parts=parts.concat(o.al);if(o.src)parts.push(o.src);if(o.tag)parts.push(o.tag);var c=o.cid?IX.co[o.cid]:null;if(c){parts.push(c.nm);if(c.al)parts=parts.concat(c.al);if(c.tag)parts.push(c.tag)}return fold(parts.join(' '))}
  B.co.forEach(function(c){c._h=hay(c,['nm','nm_ru','nm_en','seg','sub','k','reg','sl'])});
  B.si.forEach(function(s){s._h=hay(s,['h','n','ci','rg','k'])});
  B.au.forEach(function(a){a._h=hay(a,['co','nm','work','win','sl'])});
  B.pp.forEach(function(p){p._h=hay(p,['co','n','nt','p','r','e','t','src'])});
  B.le.forEach(function(l){l._h=fold('№'+l.no+' '+l.no+' '+[l.co,l.to,l.st,l.nx,l.dt].join(' '))});
  B.deals.forEach(function(d){d._h=hay(d,['co','st','what','nx'])});
  B.staff.forEach(function(s){s._h=hay(s,['n','r','t'])});
}
function allDeals(){return B.deals.concat(LS.deals)}
// ---------- helpers ----------
function uniq(arr){var m={};arr.forEach(function(x){if(x)m[x]=1});return Object.keys(m).sort(function(a,b){return a.localeCompare(b,'ru')})}
function opt(list,val,all){return '<option value="">'+esc(all)+'</option>'+list.map(function(x){return '<option'+(x===val?' selected':'')+'>'+esc(x)+'</option>'}).join('')}
function chip(t,c){return t?'<span class="chip '+(c||'')+'">'+esc(t)+'</span>':''}
function telHref(t){return 'tel:'+t.replace(/[^\d+]/g,'')}
function acts(p){var h='';(p.t||[]).forEach(function(t){h+='<a href="'+telHref(t)+'" data-stop>\u{1F4DE} '+esc(t)+'</a>'});(p.e||[]).forEach(function(e){h+='<a href="mailto:'+esc(e)+'" data-stop>\u2709 '+esc(e)+'</a>'});if(p.l)h+='<a href="'+esc(p.l)+'" target="_blank" rel="noopener" data-stop>in</a>';return h?'<div class="acts">'+h+'</div>':''}
function stChip(k){var s=ed(k).st;return s?chip(s,'ac'):''}
function ntLine(k){var n=ed(k).nt;return n?'<div class="t3">\u{1F4DD} '+esc(n.length>140?n.slice(0,140)+'…':n)+'</div>':''}
var CO_ST=['В Битриксе','Звонок','Встреча','ТКП','Договор','Пауза','Не работаем'];
var PP_ST=['Звонил','Написал','Ответил','Встреча','Неверный контакт'];
var LE_ST=['Отправлено','Прозвонил','Ответили','Вернулось','Встреча'];
var DEAL_ST=['Новая','Аудит готов','ЛПР контакт','Заявка и осмотр','Встреча','ТКП','Договор','Закрыта'];
var GEN_ST=['В работе','Отработан'];
// ---------- state / routing ----------
var ST={};
function stOf(t){return ST[t]||(ST[t]={q:'',f:{},n:50})}
function route(){var h=(location.hash||'#/deals').slice(2).split('/');return {tab:h[0]||'deals',id:h[1]}}
function go(h){location.hash=h}
function setNav(tab){
  var nav=TABS.map(function(t){return '<a href="#/'+t[0]+'" class="'+(t[0]===tab?'on':'')+'"><b>'+t[2]+'</b>'+esc(t[1])+'</a>'}).join('');
  $('#navSide').innerHTML=nav;$('#navBot').innerHTML=nav}
function render(){
  closeGS();
  var r=route();var tab=r.tab==='company'?'co':r.tab;
  setNav(tab);$('#backBtn').hidden=!(r.tab==='company'&&r.id);
  var v=$('#view');
  if(r.tab==='company')v.innerHTML=companyView(+r.id);
  else if(r.tab==='deals')v.innerHTML=dealsView();
  else if(r.tab==='team')v.innerHTML=teamView();
  else v.innerHTML=listView(r.tab);
  if(CFG[r.tab])fillList(r.tab);
  window.scrollTo(0,0);
}
// ---------- list view ----------
var CFG={
 co:{title:'Компании',ph:'Название, регион, сегмент',f:['k','seg','st','au','le']},
 si:{title:'Площадки',ph:'Площадка, город, холдинг',f:['k','seg']},
 au:{title:'Аудиты',ph:'Компания, работы, окно',f:['pri','k','seg']},
 pp:{title:'ЛПР',ph:'Имя, должность, компания, телефон',f:['k','seg','r','c','ct']},
 le:{title:'Письма',ph:'Номер, компания, адресат',f:['lst']}
};
function segOf(t,o){var c=(t==='co')?o:IX.co[o.cid];return c?c.seg:''}
function kOf(t,o){var c=(t==='co')?o:IX.co[o.cid];return c?c.k:(o.k||'')}
function listView(t){
  var c=CFG[t];if(!c)return '<div class="empty">Нет такого раздела</div>';
  var s=stOf(t);var d=B[t];
  var ks=uniq(B.co.map(function(x){return x.k})),sg=uniq(B.co.map(function(x){return x.seg}));
  var h='<div class="h"><h2>'+c.title+'</h2></div><div class="filters"><div class="full"><input id="q" type="search" placeholder="'+esc(c.ph)+'" value="'+esc(s.q)+'" autocomplete="off"></div>';
  function sel(id,label,list){return '<select data-f="'+id+'">'+opt(list,s.f[id]||'',label)+'</select>'}
  c.f.forEach(function(f){
    if(f==='k')h+=sel('k','Все кусты',ks);
    if(f==='seg')h+=sel('seg','Все сегменты',sg);
    if(f==='st')h+=sel('st','Любой статус',CO_ST);
    if(f==='pri')h+=sel('pri','Любой приоритет',['В','СВ','С','Н']);
    if(f==='r')h+=sel('r','Любая роль',['решает','закупки','влияет','союзник','площадка']);
    if(f==='c')h+=sel('c','Любой статус данных',['подтверждён','вероятно','возможно','низкая']);
    if(f==='lst')h+=sel('lst','Любой статус',uniq(B.le.map(function(x){return x.st.split(' (')[0]}).concat(LE_ST)));
    if(f==='au')h+='<label class="t"><input type="checkbox" data-f="au"'+(s.f.au?' checked':'')+'> Есть аудит</label>';
    if(f==='le')h+='<label class="t"><input type="checkbox" data-f="le"'+(s.f.le?' checked':'')+'> Есть письмо</label>';
    if(f==='ct')h+='<label class="t"><input type="checkbox" data-f="ct"'+(s.f.ct?' checked':'')+'> Есть телефон или почта</label>';
  });
  h+='</div><div class="count" id="cnt"></div><div id="list" class="cards"></div><div id="moreWrap"></div>';
  return h}
function filtered(t){
  var s=stOf(t),f=s.f,q=s.q.trim().toLowerCase(),words=q?q.split(/\s+/):[];
  return B[t].filter(function(o){
    if(o.ex&&!LS.ex)return false;
    if(f.k&&kOf(t,o)!==f.k)return false;
    if(f.seg&&segOf(t,o)!==f.seg)return false;
    if(t==='co'){
      if(f.st&&ed('c'+o.id).st!==f.st)return false;
      if(f.au&&!o.ad)return false;if(f.le&&!o.let.length)return false}
    if(t==='au'&&f.pri&&o.pri!==f.pri)return false;
    if(t==='pp'){if(f.r&&o.r!==f.r)return false;if(f.c&&o.c!==f.c)return false;if(f.ct&&!(o.e.length||o.t.length))return false}
    if(t==='le'&&f.lst&&(ed('l'+o.no).st||o.st).toLowerCase().indexOf(f.lst.toLowerCase())!==0)return false;
    return matchQ(o._h,s.q)})}
function cardHtml(t,o){
  var cl=o.ex?' ex':'';
  if(t==='co'){
    var en=coEn(o);return '<a class="card'+cl+'" href="#/company/'+o.id+'"><div class="t1"><span>'+esc(coRu(o))+(en&&en!==coRu(o)?'<span class="t1en">'+esc(en)+'</span>':'')+'</span>'+stChip('c'+o.id)+'</div><div class="t2">'+esc(o.seg)+(o.sub?' · '+esc(o.sub):'')+'</div><div class="chips">'+chip(o.k)+(o.reg?chip(o.reg):'')+(o.ad?chip('аудит','ok'):'')+(o.np?chip('ЛПР '+o.np):'')+(o.let.length?chip('письма '+o.let.join(', '),'ac'):'')+(o.ex?chip('исключён','er'):'')+'</div>'+ntLine('c'+o.id)+'</a>'}
  if(t==='si'){
    return '<a class="card" '+(o.cid?'href="#/company/'+o.cid+'"':'')+'><div class="t1"><span>'+esc(o.n)+'</span>'+stChip('s'+o.id)+'</div><div class="t2">'+esc(o.h)+'</div><div class="chips">'+chip(o.ci)+chip(o.rg)+chip(o.k)+'</div></a>'}
  if(t==='au'){
    var tone=o.pri==='В'?'er':o.pri==='СВ'?'wa':'';var PRI={'В':'высокий','СВ':'средний-высокий','С':'средний','Н':'низкий'};
    return '<a class="card'+(o.ex?' ex':'')+'" '+(o.cid?'href="#/company/'+o.cid+'"':'')+'><div class="t1"><span>'+esc(o.co)+'</span>'+chip(PRI[o.pri]||o.pri,tone)+'</div><div class="t2">'+esc(o.work||'-')+'</div><div class="chips">'+(o.sv?chip('сверка '+o.sv+'%'):'')+(o.win?chip('окно: '+o.win):'')+chip(o.k)+'</div></a>'}
  if(t==='pp'){
    var tn=o.c==='подтверждён'?'ok':o.c==='вероятно'?'wa':'';
    return '<div class="card'+cl+'" data-act="person" data-id="'+o.id+'"><div class="t1"><span>'+esc(o.n)+'</span>'+stChip('p'+o.id)+'</div><div class="t2">'+esc(o.p||'должность не указана')+'</div><div class="t3"><a href="#/company/'+o.cid+'" data-stop>'+esc(o.co)+'</a></div><div class="chips">'+chip(o.r)+chip(o.c,tn)+'</div>'+acts(o)+ntLine('p'+o.id)+'</div>'}
  if(t==='le'){
    var st=ed('l'+o.no).st||o.st;var tn2=/^ответ/.test(st)||st==='Ответили'?'ok':/^вернул|Вернул/.test(st)?'er':/черновик|PDF/.test(st)?'wa':'';
    return '<div class="card" data-act="letter" data-id="'+o.no+'"><div class="t1"><span>№'+o.no+' '+esc(o.co)+'</span>'+chip(st,tn2)+'</div><div class="t2">'+esc(o.to||'адресат не указан')+' · '+esc(o.dt)+'</div>'+(o.nx?'<div class="t3">'+esc(o.nx)+'</div>':'')+ntLine('l'+o.no)+'</div>'}
  return ''}
function fillList(t){
  var s=stOf(t),res=filtered(t);s.res=res;
  $('#cnt').textContent='Найдено: '+res.length+' из '+B[t].length+(LS.ex?'':' (исключённые скрыты)');
  var part=res.slice(0,s.n);
  $('#list').innerHTML=part.map(function(o){return cardHtml(t,o)}).join('')||'<div class="empty">Ничего не найдено</div>';
  $('#moreWrap').innerHTML=res.length>s.n?'<button class="btn more" data-act="more">Показать ещё ('+Math.min(50,res.length-s.n)+' из '+(res.length-s.n)+')</button>':'';
  observeMore();
}
var io=null;
function observeMore(){
  if(io)io.disconnect();var b=$('[data-act=more]');if(!b||!('IntersectionObserver' in window))return;
  io=new IntersectionObserver(function(e){if(e[0].isIntersecting){io.disconnect();more()}},{rootMargin:'600px'});io.observe(b)}
function more(){var t=route().tab;var s=stOf(t);var cur=$('#list').children.length;s.n+=50;var part=s.res.slice(cur,s.n);
  $('#list').insertAdjacentHTML('beforeend',part.map(function(o){return cardHtml(t,o)}).join(''));
  var left=s.res.length-s.n;$('#moreWrap').innerHTML=left>0?'<button class="btn more" data-act="more">Показать ещё ('+Math.min(50,left)+' из '+left+')</button>':'';observeMore()}
// ---------- deals ----------
function dealsView(){
  var act=B.co.filter(function(c){return !c.ex&&!c.new}).length;
  var ppN=B.pp.filter(function(p){return !p.ex}).length;
  var h='<div class="h"><h2>Сделки</h2><button class="btn sm primary" data-act="newDeal">+ Сделка</button></div><div class="metrics">'+
   m(act,'компаний на карте')+m(B.si.filter(function(x){return !x.ex}).length,'площадок')+m(ppN,'записей ЛПР')+m(B.au.filter(function(x){return !x.ex}).length,'аудитов')+m(B.le.length,'писем')+m(allDeals().length,'сделок')+'</div>';
  h+='<div class="cards">'+allDeals().map(function(d){return dealCard(d)}).join('')+'</div>';
  h+='<p class="muted" style="font-size:13px">Главный источник остаётся Битрикс: клиент, ЛПР и встреча заводятся там карточкой компании и сделкой. Здесь обзор и свои пометки.</p>';
  return h;function m(v,l){return '<div class="metric"><b>'+v+'</b><span>'+l+'</span></div>'}}
function dealCard(d){
  var k='d'+d.id,st=ed(k).st||d.st;var tn=st==='Договор'?'ok':(st==='Встреча'||st==='Заявка и осмотр')?'wa':'';
  return '<div class="card" data-act="deal" data-id="'+esc(d.id)+'"><div class="t1"><span>'+esc(d.co)+'</span>'+chip(st,tn)+'</div><div class="t2">'+esc(d.what)+'</div><div class="t3"><b>Дальше:</b> '+esc(d.nx||'-')+(d.dt?' · '+esc(d.dt):'')+'</div>'+ntLine(k)+(d.cid?'<div class="t3"><a href="#/company/'+d.cid+'" data-stop>Карточка компании</a></div>':'')+'</div>'}
// ---------- team ----------
function teamView(){
  var s=stOf('team');
  var h='<div class="h"><h2>Команда</h2></div><div class="filters"><div class="full"><input id="tq" type="search" placeholder="Имя, роль" value="'+esc(s.q)+'"></div></div><div id="tl" class="cards">'+teamList()+'</div><p class="muted" style="font-size:13px">Из плана адаптации. Только ФИО, роли и задачи, доступы не включены.</p>';
  return h}
function teamList(){var q=stOf('team').q;return B.staff.filter(function(x){return !q||matchQ(x._h,q)}).map(function(x){return '<div class="card" style="cursor:default"><div class="t1"><span>'+esc(x.n)+'</span></div><div class="t2">'+esc(x.r)+'</div><div class="t3">'+esc(x.t)+'</div></div>'}).join('')}
// ---------- company ----------
function companyView(id){
  var c=IX.co[id];if(!c)return '<div class="empty">Компания не найдена</div>';
  var k='c'+id,e=ed(k);
  var shown={},alShow=[];[coRu(c),coEn(c),c.nm].forEach(function(x){if(x)shown[x.toLowerCase()]=1});
  (c.al||[]).forEach(function(a){if(a&&!shown[a.toLowerCase()]){shown[a.toLowerCase()]=1;alShow.push(a)}});
  var h='<div class="h"><h2>'+coTitleHtml(c)+'</h2></div>';
  if(c.ex)h+='<div class="chips"><span class="chip er">исключён: не работаем</span></div>';
  h+='<div class="kv"><div><span>Сегмент</span><em>'+esc(c.seg)+(c.sub?' · '+esc(c.sub):'')+'</em></div><div><span>Куст</span><em>'+esc(c.k)+'</em></div>'+(c.reg?'<div><span>Регион</span><em>'+esc(c.reg)+'</em></div>':'')+(alShow.length?'<div><span>Также</span><em>'+esc(alShow.join(', '))+'</em></div>':'')+(c.note?'<div><span>Заметка</span><em>'+esc(c.note)+'</em></div>':'')+'</div>';
  h+='<div class="fld"><label>Статус</label><select data-ed="'+k+'" data-fld="st">'+opt(CO_ST,e.st||'','Не задан')+'</select></div><div class="fld"><label>Заметка</label><textarea data-ed="'+k+'" data-fld="nt" placeholder="Ваши пометки хранятся на этом устройстве">'+esc(e.nt||'')+'</textarea></div>';
  var ds=allDeals().filter(function(d){return d.cid===id});
  if(ds.length)h+='<div class="sec">Сделки</div><div class="cards">'+ds.map(dealCard).join('')+'</div>';
  var au=IX.auBy[id]||[];
  if(au.length)h+='<div class="sec">Аудит</div><div class="cards">'+au.map(function(a){return '<div class="card" style="cursor:default"><div class="t1"><span>'+esc(a.nm)+'</span>'+chip('приоритет '+a.pri)+'</div><div class="t2">'+esc(a.work||'-')+'</div><div class="chips">'+(a.sv?chip('сверка '+a.sv+'%'):'')+(a.win?chip('окно: '+a.win):'')+'</div><div class="t3 muted">hub: projects/audit-100tonn/output/'+esc(a.sl)+'/</div></div>'}).join('')+'</div>';
  var pp=(IX.ppBy[id]||[]);
  h+='<div class="sec">ЛПР ('+pp.length+')</div><div class="cards">'+pp.slice(0,60).map(function(p){return cardHtml('pp',p)}).join('')+'</div>'+(pp.length>60?'<p class="muted">Показаны первые 60, остальные во вкладке ЛПР (поиск по компании).</p>':'')||'';
  var le=IX.leBy[id]||[];
  if(le.length)h+='<div class="sec">Письма</div><div class="cards">'+le.map(function(l){return cardHtml('le',l)}).join('')+'</div>';
  var si=IX.siBy[id]||[];
  if(si.length)h+='<div class="sec">Площадки ('+si.length+')</div><div class="cards">'+si.map(function(s){return '<div class="card" style="cursor:default"><div class="t1"><span>'+esc(s.n)+'</span></div><div class="chips">'+chip(s.ci)+chip(s.rg)+'</div></div>'}).join('')+'</div>';
  return h}
// ---------- sheet ----------
function openSheet(html){$('#sheetBody').innerHTML=html;$('#sheet').hidden=false}
function closeSheet(){$('#sheet').hidden=true}
function editor(k,list,label){var e=ed(k);return '<div class="fld"><label>'+(label||'Статус')+'</label><select data-ed="'+k+'" data-fld="st">'+opt(list,e.st||'','Не задан')+'</select></div><div class="fld"><label>Заметка</label><textarea data-ed="'+k+'" data-fld="nt" placeholder="Хранится на этом устройстве">'+esc(e.nt||'')+'</textarea></div>'}
function personSheet(id){
  var p=B.pp[id-1];if(!p)return;
  openSheet('<h3>'+esc(p.n)+'</h3><div class="muted">'+esc(p.p||'должность не указана')+'</div><div class="t3" style="margin:6px 0"><a href="#/company/'+p.cid+'" data-act="closeSheet">'+esc(p.co)+'</a></div><div class="chips">'+chip(p.r)+chip(p.c,p.c==='подтверждён'?'ok':'wa')+'</div>'+acts(p)+(p.nt?'<div class="t3" style="margin-top:8px">'+esc(p.nt)+'</div>':'')+(p.src?'<div class="t3">Источник: '+esc(p.src)+'</div>':'')+(p.u?'<div class="t3"><a href="'+esc(p.u)+'" target="_blank" rel="noopener">Ссылка</a></div>':'')+editor('p'+id,PP_ST,'Статус контакта')+'<button class="btn" data-act="closeSheet" style="width:100%">Готово</button>')}
function letterSheet(no){
  var l=B.le.filter(function(x){return x.no==no})[0];if(!l)return;
  openSheet('<h3>Письмо №'+l.no+'</h3><div class="muted">'+esc(l.co)+'</div><div class="kv"><div><span>Дата</span><em>'+esc(l.dt)+'</em></div><div><span>Адресат</span><em>'+esc(l.to||'-')+'</em></div><div><span>Статус в базе</span><em>'+esc(l.st)+'</em></div><div><span>Шаг</span><em>'+esc(l.nx||'-')+'</em></div></div>'+(l.cid?'<a href="#/company/'+l.cid+'" data-act="closeSheet">Карточка компании</a>':'')+editor('l'+l.no,LE_ST,'Мой статус')+'<button class="btn" data-act="closeSheet" style="width:100%">Готово</button>')}
function dealSheet(id){
  var d=allDeals().filter(function(x){return String(x.id)===String(id)})[0];if(!d)return;
  var k='d'+d.id;var e=ed(k);
  openSheet('<h3>'+esc(d.co)+'</h3><div class="muted">'+esc(d.what)+'</div><div class="t3" style="margin:6px 0"><b>Дальше:</b> '+esc(d.nx||'-')+(d.dt?' · '+esc(d.dt):'')+'</div>'+editor(k,DEAL_ST,'Этап (мой)').replace('Не задан','Как в базе: '+esc(d.st))+(d.u?'<button class="btn danger sm" data-act="delDeal" data-id="'+esc(d.id)+'">Удалить сделку</button> ':'')+'<button class="btn" data-act="closeSheet" style="width:100%;margin-top:8px">Готово</button>')}
function newDealSheet(){
  openSheet('<h3>Новая сделка</h3><div class="fld"><label>Компания</label><input id="nd_co" type="text"></div><div class="fld"><label>Суть</label><input id="nd_what" type="text"></div><div class="fld"><label>Следующий шаг</label><input id="nd_nx" type="text"></div><div class="row2"><div class="fld"><label>Дата</label><input id="nd_dt" type="text" placeholder="16.11"></div><div class="fld"><label>Этап</label><select id="nd_st">'+opt(DEAL_ST,'Новая','Новая')+'</select></div></div><button class="btn primary" data-act="saveDeal" style="width:100%">Сохранить</button>')}
// ---------- global search ----------
function closeGS(){$('#gres').hidden=true;}
function gsearch(q){
  q=q.trim();var box=$('#gres');
  if(q.length<2){box.hidden=true;return}
  function m(arr,lim){var r=[],n=0;for(var i=0;i<arr.length;i++){var o=arr[i];if(o.ex&&!LS.ex)continue;if(matchQ(o._h,q)){n++;if(r.length<lim)r.push(o)}}return [r,n]}
  var out='';
  function sec(title,t,arr,lim){var x=m(arr,lim);if(!x[1])return;out+='<div class="sec">'+title+' ('+x[1]+')</div><div class="cards">'+x[0].map(function(o){return cardHtml(t,o)}).join('')+'</div>'+(x[1]>lim?'<a class="btn sm" href="#/'+t+'" data-act="seeAll" data-t="'+t+'" data-q="'+esc(q)+'">Все '+x[1]+' в разделе</a>':'')}
  var dl=allDeals();dl.forEach(function(d){if(!d._h)d._h=(d.co+' '+d.what+' '+d.nx).toLowerCase()});
  var dm=m(dl,5);if(dm[1])out+='<div class="sec">Сделки ('+dm[1]+')</div><div class="cards">'+dm[0].map(dealCard).join('')+'</div>';
  sec('Компании','co',B.co,6);sec('ЛПР','pp',B.pp,8);sec('Письма','le',B.le,4);sec('Аудиты','au',B.au,4);sec('Площадки','si',B.si,4);
  box.innerHTML=out||'<div class="empty">Ничего не найдено</div>';box.hidden=false}
// ---------- export / import ----------
function exportJson(){
  var data=JSON.stringify({app:'crm100',v:1,exported:new Date().toISOString(),ed:LS.ed,deals:LS.deals},null,1);
  var name='crm100-pometki-'+new Date().toISOString().slice(0,10)+'.json';
  var blob=new Blob([data],{type:'application/json'});
  var file=null;try{file=new File([blob],name,{type:'application/json'})}catch(e){}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:name}).catch(function(){})}
  else{var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000)}
}
function importJson(file){
  var r=new FileReader();r.onload=function(){try{
    var x=JSON.parse(r.result);if(x.app!=='crm100')throw new Error('format');
    var n=0;for(var k in (x.ed||{})){var a=LS.ed[k],b=x.ed[k];if(!a||(b.ts||0)>(a.ts||0)){LS.ed[k]=b;n++}}
    (x.deals||[]).forEach(function(d){if(!LS.deals.some(function(y){return y.id===d.id})){LS.deals.push(d);n++}});
    lsSave();toast('Импортировано записей: '+n);render()}catch(e){toast('Не тот файл')}};r.readAsText(file)}
function menuSheet(){
  var n=Object.keys(LS.ed).length;
  openSheet('<h3>Меню</h3><div class="muted" style="margin-bottom:8px">Версия данных '+esc(B.gen)+' · сборка '+esc(VERSION)+'<br>Пометок на устройстве: '+n+', своих сделок: '+LS.deals.length+'</div>'+
   '<label class="t" style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" data-act="toggleEx"'+(LS.ex?' checked':'')+'> Показывать исключённые компании</label>'+
   '<div class="acts" style="margin:10px 0"><button class="btn" data-act="export">Экспорт пометок (JSON)</button><button class="btn" data-act="import">Импорт</button></div><input type="file" id="impf" accept="application/json,.json" hidden>'+
   '<div class="acts" style="margin:10px 0"><button class="btn" data-act="refresh">Обновить данные</button><button class="btn danger" data-act="forget">Выйти и забыть ключ</button></div>'+
   '<p class="muted" style="font-size:13px">Пометки (статусы, заметки, свои сделки) хранятся только на этом устройстве. Для переноса между телефоном и Mac используйте экспорт и импорт.</p><button class="btn" data-act="closeSheet" style="width:100%">Закрыть</button>')}
// ---------- events ----------
document.addEventListener('click',function(ev){
  var t=ev.target;
  if(t.closest&&t.closest('[data-stop]'))return;
  var a=t.closest&&t.closest('[data-act]');
  if(a){var act=a.getAttribute('data-act'),id=a.getAttribute('data-id');
    if(act==='closeSheet'){closeSheet()}
    else if(act==='more'){more()}
    else if(act==='person'){personSheet(+id)}
    else if(act==='letter'){letterSheet(id)}
    else if(act==='deal'){dealSheet(id)}
    else if(act==='newDeal'){newDealSheet()}
    else if(act==='saveDeal'){var co=$('#nd_co').value.trim();if(!co){toast('Укажите компанию');return}var d={id:'u'+Date.now(),u:1,co:co,what:$('#nd_what').value.trim(),nx:$('#nd_nx').value.trim(),dt:$('#nd_dt').value.trim(),st:$('#nd_st').value,cid:0};
      var q=co.toLowerCase();var m=B.co.filter(function(c){return [c.nm,c.nm_ru,c.nm_en].concat(c.al||[]).some(function(n){return n&&n.toLowerCase().indexOf(q)>=0})})[0];if(m)d.cid=m.id;LS.deals.push(d);lsSave();closeSheet();render()}
    else if(act==='delDeal'){LS.deals=LS.deals.filter(function(x){return x.id!==id});delete LS.ed['d'+id];lsSave();closeSheet();render()}
    else if(act==='export'){exportJson()}
    else if(act==='import'){$('#impf').click();$('#impf').onchange=function(e){if(e.target.files[0])importJson(e.target.files[0])}}
    else if(act==='toggleEx'){LS.ex=t.checked;lsSave();render()}
    else if(act==='refresh'){closeSheet();loadData(true)}
    else if(act==='forget'){idbDel('key').then(function(){location.reload()})}
    else if(act==='seeAll'){ev.preventDefault();var tt=a.getAttribute('data-t');stOf(tt).q=a.getAttribute('data-q');stOf(tt).n=50;$('#gq').value='';closeGS();go('#/'+tt);render()}
    return}
  if(t.id==='menuBtn'||(t.closest&&t.closest('#menuBtn'))){menuSheet();return}
  if(t.id==='backBtn'||(t.closest&&t.closest('#backBtn'))){if(history.length>1)history.back();else go('#/co')}
});
document.addEventListener('input',function(ev){
  var t=ev.target;
  if(t.id==='q'){var tb=route().tab;stOf(tb).q=t.value;stOf(tb).n=50;fillList(tb)}
  else if(t.id==='tq'){stOf('team').q=t.value;$('#tl').innerHTML=teamList()}
  else if(t.id==='gq'){gsearch(t.value)}
  else if(t.getAttribute&&t.getAttribute('data-fld')==='nt'){var k=t.getAttribute('data-ed');clearTimeout(t._tm);t._tm=setTimeout(function(){setEd(k,{nt:t.value.trim()})},300)}
});
document.addEventListener('change',function(ev){
  var t=ev.target;
  if(t.getAttribute&&t.getAttribute('data-fld')==='st'){var k=t.getAttribute('data-ed');setEd(k,{st:t.value});toast('Сохранено');if(route().tab!=='company'||true){var tb=route().tab;if(tb!=='company'&&tb!=='deals'&&$('#list'))fillList(tb)}}
  else if(t.getAttribute&&t.getAttribute('data-fld')==='nt'){setEd(t.getAttribute('data-ed'),{nt:t.value.trim()});toast('Сохранено')}
  else if(t.getAttribute&&t.getAttribute('data-f')){var tb2=route().tab,s=stOf(tb2);var f=t.getAttribute('data-f');s.f[f]=t.type==='checkbox'?t.checked:t.value;s.n=50;fillList(tb2)}
});
window.addEventListener('hashchange',function(){if(B){render()}});
$('#sheet').addEventListener('click',function(e){if(e.target.classList.contains('sheet-bg'))closeSheet()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeSheet();closeGS()}});
// ---------- boot ----------
function showLock(msg){$('#app').hidden=true;$('#lock').hidden=false;$('#lockErr').textContent=msg||'';setTimeout(function(){$('#pass').focus()},50)}
function start(bundle){B=bundle;buildIndex();lsLoad();$('#lock').hidden=true;$('#app').hidden=false;$('#verSide').textContent='Данные от '+B.gen;render()}
var HDR=null;
function loadData(manual){
  return fetchEnc().then(function(h){HDR=h;return idbGet('key').then(function(key){
    if(!key)return showLock();
    return decryptWith(key,h).then(function(b){start(b);if(manual)toast('Данные обновлены')}).catch(function(){idbDel('key');showLock('Ключевая фраза изменилась, введите заново')})})
  }).catch(function(e){
    if(!HDR)showLock('Не удалось загрузить данные. Проверьте интернет.')})}
$('#lockForm').addEventListener('submit',function(e){
  e.preventDefault();var p=$('#pass').value;if(!p||!HDR)return;
  $('#lockErr').textContent='Проверяю...';
  deriveKey(p,HDR).then(function(key){return decryptWith(key,HDR).then(function(b){
    var keep=$('#remember').checked?idbSet('key',key):Promise.resolve();
    return keep.then(function(){$('#pass').value='';start(b)})})
  }).catch(function(){$('#lockErr').textContent='Неверная ключевая фраза'})});
lsLoad();
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(function(){})}
if(!window.crypto||!crypto.subtle){document.body.innerHTML='<p style="padding:20px">Нужен защищённый адрес (https) и современный браузер.</p>'}
else loadData(false);
})();
