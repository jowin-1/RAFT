import {TABLES,ROLE_NAMES,columnsFor,editableTables,editableFields,readRole,readAll} from './model.js';

const supabase=window.supabase.createClient('https://xigccgybcolmyntytkdh.supabase.co','sb_publishable_QLyjtpmvoiZh4xvLIvc1mQ_9ANBiRBj',{db:{schema:'raft'},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const root=document.getElementById('app');
let session=null,role=null,data=null,loading=false,loadError='',authError='',authBusy=false,version=0;
let screen='home',search='',selectedClient=null,recordTable='client',recordKey='',recordMode='new',clientPersonMode='new',partialPerson=null,formMessage='',formError=false,saving=false;
const icons={home:'M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',chart:'M4 20V10m8 10V4m8 16v-7',plus:'M12 5v14M5 12h14',arrow:'M5 12h14m-5-5 5 5-5 5',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7-7.87a4 4 0 0 1 0 7.75',calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',door:'M4 21h16M6 21V4l12-2v19m-4-10v2',logout:'M9 21H4V3h5m6 14 5-5-5-5m-7 5h12',shield:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z',check:'M5 12l4 4L19 6',refresh:'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3a7 7 0 0 0 11.6-2',edit:'M16 3l5 5L9 20l-6 1 1-6zM14 5l5 5'};
const icon=(name)=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.users}"/></svg>`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=v=>v===null||v===undefined||v===''?'Not provided':esc(v);
const list=t=>data?.[t]||[];
const find=(t,id)=>list(t).find(r=>String(r[TABLES[t].keys[0]])===String(id));
const person=id=>find('person',id);
const name=id=>{const p=person(id); return p ? [p.firstname,p.lastname].filter(Boolean).join(' ')||`Person #${id}` : `Person #${id}`;};
const initials=id=>{const p=person(id);return esc(((p?.firstname?.[0]||'')+(p?.lastname?.[0]||''))||'–');};
const fullDate=(v)=>{if(!v)return 'Not scheduled';const d=new Date(String(v).slice(0,10)+'T12:00:00');return Number.isNaN(+d)?String(v):d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});};
const time=v=>{if(!v)return 'No time';const m=String(v).match(/T(\d{2}):(\d{2})/);return m?`${Number(m[1])%12||12}:${m[2]} ${Number(m[1])>=12?'PM':'AM'}`:'No time';};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const todayAppts=()=>list('appointment').filter(a=>a.appointmenttime?.slice(0,10)===today()).sort((a,b)=>a.appointmenttime.localeCompare(b.appointmenttime));
const attendance=k=>k===true?'Kept':k===false?'Not kept':'Not recorded';
const keyOf=(t,row)=>TABLES[t].keys.map(k=>row[k]).join(':');
const selectedRecord=()=>list(recordTable).find(r=>keyOf(recordTable,r)===recordKey);
const brand=()=>`<div class="brand"><span class="brand-mark"><svg width="26" height="26" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M5 22h22M8 26h16M10 18l6-13 7 13zM16 5v13"/></svg></span><div><span class="brand-name">RAFT</span><span class="brand-sub">Richmond Area Family Therapy</span></div></div>`;
const landscape=()=>`<svg viewBox="0 0 480 300" preserveAspectRatio="xMidYMax slice" role="img" aria-label="A quiet river flowing through green hills"><circle cx="330" cy="85" r="38" fill="#c5ceab"/><path d="M0 170Q95 38 213 163Q319 68 480 148V300H0Z" fill="#b7c49f"/><path d="M0 210Q105 135 235 204Q353 117 480 183V300H0Z" fill="#91a582"/><path d="M0 256Q104 182 251 243Q341 202 480 227V300H0Z" fill="#6d896c"/><path d="M290 180Q225 204 289 223Q361 247 200 300H350Q412 250 318 223Q258 207 307 180Z" fill="#dce3ca"/><path d="M53 274v-88m0 20-19 18m19-3 23-24m-23 51-27-22m27 34 23-24M419 272v-91m0 25-20 15m20 5 20-25m-20 46-28-20" stroke="#4e6a50" stroke-width="2" fill="none"/><path d="M169 166v-49m0 13-13 10m13 7 15-16" stroke="#6e8861" stroke-width="1.6"/></svg>`;
const notice=(text,error=false)=>text?`<div class="notice ${error?'error':'success'}" role="${error?'alert':'status'}">${esc(text)}</div>`:'';

function signInView(){
 root.innerHTML=`<main class="auth"><section class="auth-story">${brand()}<div class="auth-copy"><div class="eyebrow"><span class="dot"></span> Care starts with connection</div><h1>A little clarity.<br>A lot of care.</h1><p>A welcoming space for families.<br>A thoughtful workspace for the people who help them.</p></div><div class="auth-art">${landscape()}</div></section><section class="auth-form-side"><div class="auth-form-box"><div class="eyebrow">Your front-desk workspace</div><h2>Welcome to RAFT.</h2><p class="subtitle">Sign in with your staff account to get started.</p>${notice(authError,true)}${session?`<p class="subtitle">This account does not have a recognized RAFT role. Ask your Supabase administrator to assign raft_admin, raft_scheduler, or raft_counselor in the access token’s role claim.</p><button class="btn" id="signout">Sign out ${icon('logout')}</button>`:`<form id="signin"><div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" placeholder="you@example.com" autocomplete="username" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required></div><button class="btn" ${authBusy?'disabled':''}>${authBusy?'Signing in…':'Sign in'} ${icon('arrow')}</button></form>`}<p class="auth-note">${icon('shield')} Secure access for authorized RAFT staff.<br>Your access is based on your assigned staff role.</p></div><div class="auth-foot">Richmond Area Family Therapy · Staff workspace</div></section></main>`;
 document.getElementById('signin')?.addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget;const email=form.email.value.trim(),password=form.password.value;
  authBusy=true;authError='';const button=form.querySelector('button');button.disabled=true;button.textContent='Signing in…';
  try{const {data:result,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;await applySession(result.session);}catch(error){authError=error.code==='invalid_credentials'||error.status===400?'The email or password is incorrect. Please try again.':`Unable to sign in. ${error.message}`;}
  finally{authBusy=false;if(!session)signInView();}
 });
 document.getElementById('signout')?.addEventListener('click',signOut);
}

function shell(content){
 const nav=[['home','Home','home'],['lookup','Client lookup','search'],['dashboard','Dashboard','chart'],['records','Add or edit a record','edit']];
 root.innerHTML=`<header><a href="#home" aria-label="RAFT home">${brand()}</a><nav aria-label="Main navigation">${nav.map(([id,label,ico])=>`<a href="#${id}" class="${screen===id?'active':''}" ${screen===id?'aria-current="page"':''}>${icon(ico)}${label}</a>`).join('')}</nav><div class="account"><span class="avatar">${ROLE_NAMES[role]?.[0]||'?'}</span><div><strong>${esc(ROLE_NAMES[role])}</strong><small class="account-email" title="${esc(session.user.email)}">Staff workspace</small></div><button class="signout" id="signout" title="Sign out" aria-label="Sign out">Sign out ${icon('logout')}</button></div></header><main class="page" id="main">${content}<footer><span>RAFT <span aria-hidden="true">/</span> Richmond Area Family Therapy</span><span>${icon('shield')} Signed in as ${esc(ROLE_NAMES[role])} · Confidential staff workspace</span></footer></main>`;
 document.getElementById('signout').addEventListener('click',signOut);
 document.querySelectorAll('[data-edit-client]').forEach(b=>b.onclick=()=>openRecord('client',b.dataset.editClient));
 document.querySelectorAll('[data-edit-appt]').forEach(b=>b.onclick=()=>openRecord('appointment',b.dataset.editAppt));
 document.querySelectorAll('[data-edit-participation]').forEach(b=>b.onclick=()=>openRecord('scheduledfor',b.dataset.editParticipation));
 document.querySelector('[data-refresh]')?.addEventListener('click',loadData);
}
function render(){
 if(!session||!role){signInView();return;}
 if(loading||!data){shell(`<div class="eyebrow">Staff workspace</div><div class="page-title"><h1>${loading?'Getting things ready…':'Unable to load your workspace'}</h1></div>${loading?'<div class="empty"><span class="spinner"></span>Loading RAFT records…</div>':`${notice(loadError,true)}<button class="btn" data-refresh>Try again ${icon('refresh')}</button>`}`);return;}
 if(screen==='home')shell(homeView());
 if(screen==='lookup'){shell(lookupView());bindLookup();}
 if(screen==='dashboard')shell(dashboardView());
 if(screen==='records'){shell(recordsView());bindRecords();}
}
const stat=(label,n,note,ico)=>`<div class="stat"><div class="stat-label">${label}${icon(ico)}</div><div class="stat-value">${esc(n)}</div><div class="stat-note">${note}</div></div>`;
function homeView(){
 const appts=todayAppts();
 return `<div class="section-head"><div class="eyebrow"><span class="dot"></span> Front desk / Home</div><div class="date">${icon('calendar')}${new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date())}</div></div><section class="hero"><div class="hero-copy"><div class="eyebrow">Welcome to your workspace</div><h1>A little clarity.<br>A lot of care.</h1><p>Everything you need to help the day flow.<br>Find a client, plan an appointment, and keep care connected.</p></div><div class="hero-art">${landscape()}<span class="art-label">Stronger connections. Together.</span></div></section><div class="stats">${stat('Today’s appointments',appts.length,'Scheduled for today','calendar')}${stat('Clients',list('client').length,'Across the practice','users')}${stat('Families',list('family').length,'Connections that matter','home')}${stat('Counselors',list('counselor').length,'Part of the RAFT team','users')}</div><div class="home-grid"><section><div class="section-head"><h2>A look at today</h2><a href="#dashboard" class="text-link">View dashboard ${icon('arrow')}</a></div><div class="panel flush"><div class="panel-head"><h3>Today’s appointments</h3><span class="count-tag">${appts.length} scheduled</span></div>${appts.length?appts.slice(0,5).map(a=>appointmentRow(a)).join(''):'<div class="empty">'+icon('calendar')+'<p>No appointments scheduled for today.</p></div>'}</div></section><aside><div class="section-head"><h2>Where would you like to go?</h2></div><div class="panel"><a href="#lookup" class="quick-link"><span class="quick-icon">${icon('search')}</span><div><strong>Find a client</strong><p>Contact details, appointments, and family</p></div>${icon('arrow')}</a><a href="#records" class="quick-link"><span class="quick-icon">${icon('edit')}</span><div><strong>${role==='raft_counselor'?'Update care records':'Add or edit a record'}</strong><p>${role==='raft_counselor'?'Notes, assignments, and attendance':'Keep client and appointment details current'}</p></div>${icon('arrow')}</a><a href="#dashboard" class="quick-link"><span class="quick-icon">${icon('chart')}</span><div><strong>See the bigger picture</strong><p>A snapshot of the practice</p></div>${icon('arrow')}</a></div><div class="aside-note"><div class="eyebrow">${icon('shield')} Your workspace, your role</div>Signed in as <strong>${ROLE_NAMES[role]}</strong>. ${role==='raft_counselor'?'You can update appointment notes, client assignments, and attendance.':role==='raft_scheduler'?'You can manage contacts, clients, rooms, and scheduling.':'You have full access to RAFT records.'}</div></aside></div>`;
}
function appointmentRow(a){
 const clients=list('scheduledfor').filter(s=>s.appointmentid===a.appointmentid).map(s=>name(s.clientid));
 const room=find('room',a.roomnumber);
 return `<div class="appointment-row"><div class="appt-time">${esc(time(a.appointmenttime))}<small>${a.duration==null?'Duration not set':`${esc(a.duration)} minutes`}</small></div><div class="appt-main"><strong>${esc(clients.join(', ')||'No clients linked')}</strong><p>${esc(name(a.counselorid))} · ${esc(room?.roomname||`Room ${a.roomnumber}`)}</p></div><button class="btn light small" data-edit-appt="${a.appointmentid}" aria-label="Edit appointment ${a.appointmentid}">${icon('arrow')}</button></div>`;
}
function lookupView(){
 const q=search.toLowerCase().trim();
 const matches=list('client').filter(c=>{const p=person(c.clientid)||{};return [name(c.clientid),c.clientid,p.phone,p.email].some(v=>String(v??'').toLowerCase().includes(q));});
 return `<div class="eyebrow">Front desk / Client lookup</div><div class="page-title"><div><h1>A familiar face, a quick find.</h1><p class="subtitle">Client details and the connections around them, in one place.</p></div>${role!=='raft_counselor'?'<button class="btn" id="new-client">'+icon('plus')+' Add a client</button>':''}</div><div class="split"><aside><div class="search">${icon('search')}<label class="sr-only" for="client-search">Search clients by name, ID, email, or phone</label><input type="search" id="client-search" value="${esc(search)}" placeholder="Name, ID, email, or phone"></div><div class="list-caption" id="result-count">${matches.length} client${matches.length===1?'':'s'}</div><div class="panel flush client-list" id="client-list">${clientResults(matches)}</div></aside><section class="client-detail" id="client-detail">${clientDetail()}</section></div>`;
}
function clientResults(matches){return matches.length?matches.map(c=>`<button class="client-item ${String(selectedClient)===String(c.clientid)?'selected':''}" data-client="${c.clientid}" aria-pressed="${String(selectedClient)===String(c.clientid)}"><span class="avatar">${initials(c.clientid)}</span><span><strong>${esc(name(c.clientid))}</strong><small>Client #${c.clientid}</small></span></button>`).join(''):'<div class="empty">No clients match your search.</div>';}
function clientAppointmentGroups(bookings, now=new Date()){
 // Compare RAFT's timezone-free timestamps with Richmond's current wall time.
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const current=`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
 const groups={upcoming:[],past:[],undated:[]};
 const stamp=s=>s.appointment?.appointmenttime?.replace(' ','T').slice(0,19);
 for(const booking of bookings){
  const at=stamp(booking);
  groups[!at?'undated':at>=current?'upcoming':'past'].push(booking);
 }
 const byTime=(a,b)=>stamp(a).localeCompare(stamp(b))||a.appointmentid-b.appointmentid;
 groups.upcoming.sort(byTime);
 groups.past.sort((a,b)=>byTime(b,a));
 groups.undated.sort((a,b)=>a.appointmentid-b.appointmentid);
 return groups;
}
function clientAppointmentSection(title,bookings,emptyText,highlightNext=false){
 return `<section class="panel flush" aria-label="${esc(title)}"><div class="panel-head"><h2>${esc(title)}</h2><span class="count-tag">${bookings.length} linked</span></div>${bookings.length?bookings.map((s,index)=>{
  const a=s.appointment,next=highlightNext&&index===0;
  return `<div class="appointment-row" ${next?'style="background:var(--sage)"':''}><div class="appt-time">${esc(time(a?.appointmenttime))}<small>${esc(fullDate(a?.appointmenttime))}</small></div><div class="appt-main">${next?'<p style="margin:0 0 8px"><span class="pill">Next appointment</span></p>':''}<strong>${a?esc(name(a.counselorid)):'Appointment #'+s.appointmentid}</strong><p>${a?`${a.duration==null?'Duration not set':esc(a.duration)+' minutes'} · ${esc(find('room',a.roomnumber)?.roomname||'Room '+a.roomnumber)}`:''}</p><p>${attendance(s.kept)}</p>${role!=='raft_scheduler'?`<div class="long-text"><strong>Notes:</strong> ${value(a?.notes)}<br><strong>Assignment:</strong> ${value(s.assignment)}</div>`:''}<button class="text-link signout" data-edit-participation="${keyOf('scheduledfor',s)}">Update ${role==='raft_scheduler'?'attendance':'assignment / attendance'} ${icon('arrow')}</button></div></div>`;
 }).join(''):`<div class="empty">${esc(emptyText)}</div>`}</section>`;
}
function clientDetail(){
 const c=find('client',selectedClient);if(!c)return `<div class="panel empty">${icon('search')}<h2>Make a connection.</h2><p>Select a client to see their contact details,<br>appointments, and family memberships.</p></div>`;
 const p=person(c.clientid)||{};
 const bookings=list('scheduledfor').filter(s=>s.clientid===c.clientid).map(s=>({...s,appointment:find('appointment',s.appointmentid)}));
 const appointments=clientAppointmentGroups(bookings);
 const memberships=list('member_in_family').filter(m=>m.memberid===c.clientid);
 return `<div class="panel"><div class="person-header"><span class="avatar">${initials(c.clientid)}</span><div><h2>${esc(name(c.clientid))}</h2><small>Client #${c.clientid}</small></div>${role!=='raft_counselor'?`<button class="btn light small" data-edit-client="${c.clientid}">${icon('edit')} Edit client</button>`:''}</div><dl class="contact-grid"><div><dt>Email address</dt><dd>${value(p.email)}</dd></div><div><dt>Phone number</dt><dd>${value(p.phone)}</dd></div><div><dt>Address</dt><dd>${[p.address,[p.city,p.state,p.zip].filter(Boolean).join(', ')].filter(Boolean).map(esc).join('<br>')||'Not provided'}</dd></div><div><dt>Reminder method</dt><dd>${value(c.remindermethod)}</dd></div><div><dt>Found RAFT through</dt><dd>${value(c.foundout)}</dd></div><div><dt>Referred by</dt><dd>${c.referredby==null?'Not provided':esc(name(c.referredby))}</dd></div></dl></div>${clientAppointmentSection('Upcoming appointments',appointments.upcoming,'No upcoming appointments are scheduled.',true)}${clientAppointmentSection('Past appointments',appointments.past,'No past appointments are recorded.')}${appointments.undated.length?clientAppointmentSection('Appointments without a date',appointments.undated,''):''}<div class="panel flush"><div class="panel-head"><h2>Family connections</h2><span class="count-tag">${memberships.length} families</span></div>${memberships.length?memberships.map(m=>{const family=find('family',m.familyid);const roles=list('member_role').filter(r=>r.familyid===m.familyid&&r.memberid===m.memberid).map(r=>find('role',r.roleid)?.rolename||'Role #'+r.roleid);return `<div class="family-row"><span class="quick-icon">${icon('home')}</span><div><strong>${esc(family?.familyname||'Family #'+m.familyid)}</strong><small>${m.datejoined?'Joined '+esc(fullDate(m.datejoined)):'Join date not recorded'}</small></div><div class="tags">${roles.length?roles.map(r=>`<span class="pill">${esc(r)}</span>`).join(''):'<span class="pill neutral">No role assigned</span>'}</div></div>`;}).join(''):'<div class="empty">No family memberships are recorded for this client.</div>'}</div>`;
}
function bindLookup(){
 const bindItems=()=>document.querySelectorAll('[data-client]').forEach(b=>b.onclick=()=>{selectedClient=b.dataset.client;render();});bindItems();
 document.getElementById('client-search').oninput=e=>{search=e.target.value;const q=search.toLowerCase().trim();const matches=list('client').filter(c=>{const p=person(c.clientid)||{};return [name(c.clientid),c.clientid,p.phone,p.email].some(v=>String(v??'').toLowerCase().includes(q));});document.getElementById('client-list').innerHTML=clientResults(matches);document.getElementById('result-count').textContent=`${matches.length} client${matches.length===1?'':'s'}`;bindItems();};
 document.getElementById('new-client')?.addEventListener('click',()=>openRecord('client'));
}
function dashboardView(){
 const appts=list('appointment'),links=list('scheduledfor');const kept=links.filter(s=>s.kept===true).length,missed=links.filter(s=>s.kept===false).length,recorded=kept+missed;
 const bars=(items)=>{const max=Math.max(1,...items.map(x=>x[1]));return items.length?items.map(([label,n])=>`<div class="bar-row"><span>${esc(label)}</span><div class="bar"><span style="width:${100*n/max}%"></span></div><span>${n}</span></div>`).join(''):'<div class="empty">No records yet.</div>';};
 const sources=new Map();for(const c of list('client')){const source=c.foundout||'Not recorded';sources.set(source,(sources.get(source)||0)+1);}
 return `<div class="eyebrow">Front desk / Dashboard</div><div class="page-title"><div><h1>The bigger picture.</h1><p class="subtitle">A current snapshot of RAFT, calculated from your records.</p></div><div class="refresh-row"><button class="btn light" data-refresh>${icon('refresh')} Refresh data</button></div></div><div class="stats">${stat('Clients',list('client').length,'All client records','users')}${stat('Appointments',appts.length,'All appointment records','calendar')}${stat('Families',list('family').length,'All family records','home')}${stat('Rooms',list('room').length,'Available in the room directory','door')}</div><div class="dashboard-grid"><section class="panel"><div class="section-head"><h2>Attendance at a glance</h2>${icon('check')}</div><p class="subtitle">Per client, per appointment. Unrecorded attendance is excluded from the rate.</p><div class="metric-big">${recorded?Math.round(kept/recorded*100)+'%':'—'} <small>kept rate</small></div><div class="inline-stats"><div><strong>${kept}</strong><small>Kept</small></div><div><strong>${missed}</strong><small>Not kept</small></div><div><strong>${links.length-recorded}</strong><small>Not recorded</small></div></div>${bars([['Kept',kept],['Not kept',missed],['Not recorded',links.length-recorded]])}</section><section class="panel"><h2>How clients found RAFT</h2><p class="subtitle">From the client’s recorded referral source.</p>${bars([...sources].sort((a,b)=>b[1]-a[1]))}</section><section class="panel"><h2>Appointments by counselor</h2><p class="subtitle">All dates, including appointments without a linked client.</p>${bars(list('counselor').map(c=>[name(c.counselorid),appts.filter(a=>a.counselorid===c.counselorid).length]))}</section><section class="panel"><h2>Practice connections</h2><p class="subtitle">People, relationships, and the team behind the care.</p><div class="inline-stats"><div><strong>${list('person').length}</strong><small>People</small></div><div><strong>${list('employee').length}</strong><small>Employees</small></div><div><strong>${list('counselor').length}</strong><small>Counselors</small></div></div><div class="inline-stats"><div><strong>${list('member_in_family').length}</strong><small>Family memberships</small></div><div><strong>${list('member_role').length}</strong><small>Membership roles</small></div></div>${role==='raft_admin'?`<div class="form-section">Employee wages · Admin access</div><div class="table-wrap"><table><thead><tr><th>Employee</th><th>Hourly wage</th></tr></thead><tbody>${list('employee').map(e=>`<tr><td>${esc(name(e.employeeid))}</td><td>${e.wage==null?'Not provided':'$'+Number(e.wage).toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="2">No employees recorded.</td></tr>'}</tbody></table></div>`:''}</section></div><p class="form-hint" style="margin-top:20px">Figures reflect records available to your signed-in role. Appointment times are displayed as stored in RAFT.</p>`;
}

function recordLabel(t,r){
 if(['person','client','counselor','employee','family_member'].includes(t))return `${name(r[TABLES[t].keys[0]])} · #${r[TABLES[t].keys[0]]}`;
 if(t==='appointment')return `#${r.appointmentid} · ${fullDate(r.appointmenttime)} · ${time(r.appointmenttime)} · ${name(r.counselorid)}`;
 if(t==='scheduledfor')return `#${r.appointmentid} · ${name(r.clientid)}`;
 if(t==='room')return `${r.roomname||'Room'} · #${r.roomnumber}`;
 if(t==='family')return `${r.familyname||'Family'} · #${r.familyid}`;
 if(t==='role')return `${r.rolename||'Role'} · #${r.roleid}`;
 return `${r.familyid?find('family',r.familyid)?.familyname||'Family #'+r.familyid:''} · ${r.memberid?name(r.memberid):''}${r.roleid?' · '+(find('role',r.roleid)?.rolename||'Role #'+r.roleid):''}`;
}
function options(t,selected,empty='Select…'){
 return `<option value="">${empty}</option>`+list(t).map(r=>`<option value="${esc(keyOf(t,r))}" ${String(selected)===keyOf(t,r)?'selected':''}>${esc(recordLabel(t,r))}</option>`).join('');
}
function fieldView(f,row){
 const [id,label,type,param,required]=f;const v=row?.[id]??'';const common=`id="f-${id}" name="${id}" ${required?'required':''}`;let control;
 if(type==='ref')control=`<select ${common}>${options(param,v,required?'Select…':'None')}</select>`;
 else if(type==='boolean')control=`<select ${common}><option value="" ${v===''?'selected':''}>Not recorded</option><option value="true" ${v===true?'selected':''}>Kept</option><option value="false" ${v===false?'selected':''}>Not kept</option></select>`;
 else if(type==='textarea')control=`<textarea ${common} maxlength="${param}" rows="4">${esc(v)}</textarea>`;
 else control=`<input ${common} type="${type}" value="${esc(type==='datetime-local'?String(v).replace(' ','T'):v)}" ${typeof param==='number'?`maxlength="${param}"`:''} ${id==='wage'?'step="0.01" min="-99.99" max="99.99"':type==='number'?'step="1"':type==='datetime-local'?'step="any"':''}>`;
 return `<div class="field ${type==='textarea'?'wide':''}"><label for="f-${id}">${esc(label)}${required?' <span aria-hidden="true">*</span>':''}</label>${control}</div>`;
}
function recordsView(){
 const tables=Object.keys(TABLES),canEdit=editableTables(role).includes(recordTable);
 if(!canEdit)recordMode='view';
 if(role==='raft_counselor'&&recordMode==='new')recordMode='edit';
 const editing=recordMode==='edit',existing=recordMode!=='new';const row=existing?selectedRecord():null;
 const fields=editableFields(recordTable,role,editing);const client=recordTable==='client';
 let body='';
 if(existing&&!row)body='<div class="empty">Select an existing record to '+(editing?'update':'view')+'.</div>';
 else if(recordMode==='view')body=readOnlyRecord(recordTable,row);
 else {
  if(role==='raft_counselor')body+=`<div class="read-only">${recordTable==='appointment'?`Appointment #${row.appointmentid} · ${esc(fullDate(row.appointmenttime))} · ${esc(time(row.appointmenttime))} · ${esc(name(row.counselorid))}`:`Appointment #${row.appointmentid} · ${esc(name(row.clientid))}`}<br>Your Counselor role can update only ${recordTable==='appointment'?'appointment notes':'assignment and attendance'}.</div>`;
  if(client){
   body+='<div class="form-section">Contact information</div>';
   if(!editing)body+=`<div class="field" style="margin-bottom:22px"><label for="person-mode">Client contact</label><select id="person-mode" ${partialPerson?'disabled':''}><option value="new" ${clientPersonMode==='new'?'selected':''}>Create a new person</option><option value="existing" ${clientPersonMode==='existing'?'selected':''}>Use an existing person</option></select></div>`;
   if(!editing&&clientPersonMode==='existing')body+=`<div class="field" style="margin-bottom:22px"><label for="existing-person">Person *</label><select name="existing_person" id="existing-person" required>${options('person','', 'Select an existing person…')}</select><p class="form-hint">Contact details stay on the existing person record. Edit them under Person if needed.</p></div>`;
   else if(!partialPerson)body+=`<div class="form-grid">${TABLES.person.fields.map(f=>fieldView(f,editing?person(row.clientid):null)).join('')}</div>`;
   else body+=`<div class="notice">Contact #${partialPerson} has been saved. Complete the client details below to finish adding this client.</div>`;
   body+='<div class="form-section">Client information</div>';
  }
  body+=`<div class="form-grid">${fields.map(f=>fieldView(f,row)).join('')}</div>`;
  if(recordTable==='scheduledfor'&&!editing)body+='<p class="form-hint" style="margin-top:15px">This links one client to an existing appointment. Add one participation record for each client attending.</p>';
  if(recordTable==='appointment'&&!editing)body+='<p class="form-hint" style="margin-top:15px">After saving the appointment, use Appointment participation to link its clients.</p>';
  if(recordTable==='member_role'&&!editing)body+='<p class="form-hint" style="margin-top:15px">The person must already belong to the selected family through a family membership record.</p>';
  body+=`<div class="form-actions"><p class="form-hint">${editing?'Changes are saved to the selected record.':'Fields marked * are required.'}<br>${['appointment','scheduledfor'].includes(recordTable)?'Appointment times use the value stored in RAFT.':''}</p><button class="btn" ${saving?'disabled':''}>${saving?'Saving…':editing?'Save changes':'Add '+TABLES[recordTable].label.toLowerCase()} ${icon('check')}</button></div>`;
 }
 return `<div class="eyebrow">Front desk / Add or edit a record</div><div class="page-title"><div><h1>${role==='raft_counselor'?'Keep care connected.':'Good care starts with good records.'}</h1><p class="subtitle">${role==='raft_counselor'?'Update notes, assignments, and attendance for existing appointments.':'Add a new record or keep an existing one up to date.'}</p></div></div><div class="form-layout"><aside class="form-intro"><h2>A place for every detail.</h2><p>${role==='raft_counselor'?'Choose an appointment to update its notes, or appointment participation to update a client’s assignment and attendance.':'Choose the record you want to work with, then add or update its details.'}</p><div class="aside-note"><div class="eyebrow">${icon('shield')} ${ROLE_NAMES[role]} access</div>${role==='raft_admin'?'You can view and edit every RAFT table, including employee wages.':role==='raft_scheduler'?'Manage people, clients, rooms, appointments, and participation. Clinical notes and assignments are restricted.':'Your editing access is limited to appointment notes, assignments, and attendance.'}</div><p class="form-hint" style="margin-top:20px">For a new client, choose an existing person when their contact record is already in RAFT.</p></aside><section class="panel">${notice(formMessage,formError)}<div class="record-selectors"><div class="field"><label for="record-table">Record type</label><select id="record-table" ${partialPerson?'disabled':''}>${tables.map(t=>`<option value="${t}" ${t===recordTable?'selected':''}>${TABLES[t].label}</option>`).join('')}</select></div><div class="field"><label for="record-mode">Action</label><select id="record-mode" ${partialPerson?'disabled':''}>${canEdit&&role!=='raft_counselor'?`<option value="new" ${recordMode==='new'?'selected':''}>Add a new record</option>`:''}${canEdit?`<option value="edit" ${editing?'selected':''}>Edit an existing record</option>`:''}<option value="view" ${recordMode==='view'?'selected':''}>View an existing record</option></select></div></div>${existing?`<div class="field" style="margin-bottom:25px"><label for="record-key">Select ${TABLES[recordTable].label.toLowerCase()}</label><select id="record-key">${options(recordTable,recordKey,'Select an existing record…')}</select></div>`:''}<form id="record-form">${body}</form></section></div>`;
}
function readOnlyRecord(table,row){
 const labels={personid:'Person ID',clientid:'Client ID',counselorid:'Counselor ID',employeeid:'Employee ID',memberid:'Member ID',familyid:'Family ID',roleid:'Family role ID',appointmentid:'Appointment ID',supervisorid:'Supervisor ID',roomnumber:'Room number'};
 return `<div class="read-only">Viewing ${esc(TABLES[table].label.toLowerCase())} · ${esc(recordLabel(table,row))}</div><dl class="contact-grid">${columnsFor(table,role).split(',').map(col=>{const f=TABLES[table].fields.find(f=>f[0]===col);const label=f?.[1]||labels[col]||col;let v=row[col];if(f?.[2]==='boolean')v=attendance(v);else if(f?.[2]==='ref'&&v!=null){const referenced=find(f[3],v);v=referenced?recordLabel(f[3],referenced):v;}return `<div><dt>${esc(label)}</dt><dd class="long-text">${value(v)}</dd></div>`;}).join('')}</dl>`;
}
function bindRecords(){
 document.getElementById('record-table').onchange=e=>{recordTable=e.target.value;recordKey='';formMessage='';render();};
 document.getElementById('record-mode').onchange=e=>{recordMode=e.target.value;recordKey='';formMessage='';render();};
 document.getElementById('record-key')?.addEventListener('change',e=>{recordKey=e.target.value;formMessage='';render();});
 document.getElementById('person-mode')?.addEventListener('change',e=>{clientPersonMode=e.target.value;render();});
 document.getElementById('record-form').onsubmit=saveRecord;
}
function parseFields(form,fields){
 const payload={};for(const [id,,type] of fields){const v=form.get(id);if(v===null)throw new Error(`Missing field: ${id}`);payload[id]=v===''?null:type==='number'||type==='ref'?Number(v):type==='boolean'?v==='true':id==='state'?v.toUpperCase():v;}
 return payload;
}
async function saveRecord(e){
 e.preventDefault();if(saving||!session||!role||recordMode==='view')return;
 const table=recordTable,editing=recordMode==='edit',row=selectedRecord(),activeVersion=version;
 if(role==='raft_counselor'&&!editing)return;
 if(editing&&!row)return;
 const form=new FormData(e.currentTarget);const fields=editableFields(table,role,editing);if(!fields.length && !(table==='family_member'&&!editing))return;
 const button=e.currentTarget.querySelector('button[type="submit"],button.btn');saving=true;button.disabled=true;button.textContent='Saving…';formMessage='';
 const write=async (table,payload,oldRow)=>{
  if(!session||activeVersion!==version)throw new Error('Your session changed. Sign in again before saving.');
  let query=oldRow?supabase.from(table).update(payload):supabase.from(table).insert(payload);
  if(oldRow)for(const key of TABLES[table].keys)query=query.eq(key,oldRow[key]);
  const {data:result,error}=await query.select(columnsFor(table,role)).single();
  if(error)throw new Error(`${TABLES[table].label}: ${error.message}`);return result;
 };
 try{
  const payload=parseFields(form,fields);let personId=null;
  if(table==='client'){
   if(editing){personId=row.clientid;await write('person',parseFields(form,TABLES.person.fields),person(personId));}
   else if(partialPerson)personId=partialPerson;
   else if(clientPersonMode==='existing'){
    personId=Number(form.get('existing_person'));if(!personId)throw new Error('Choose a person for this client.');
    if(find('client',personId))throw new Error('That person is already a client. Choose Edit an existing record to update them.');
   }else{
    const created=await write('person',parseFields(form,TABLES.person.fields));personId=created.personid;partialPerson=personId;
    data.person.push(created);
   }
   if(!editing)payload.clientid=personId;
  }
  const saved=await write(table,payload,editing?row:null);
  if(activeVersion!==version)return;
  const index=data[table].findIndex(r=>keyOf(table,r)===keyOf(table,saved));if(index>=0)data[table][index]=saved;else data[table].push(saved);
  if(table==='client'&&editing){const p=person(row.clientid);Object.assign(p,parseFields(form,TABLES.person.fields));}
  partialPerson=null;recordMode='edit';recordKey=keyOf(table,saved);formError=false;formMessage=`${TABLES[table].label} ${editing?'updated':'added'} successfully.${table==='appointment'&&!editing?' Choose Appointment participation to link clients to this appointment.':''}`;
 }catch(error){
  if(activeVersion!==version)return;
  formError=true;formMessage=error.message;
  if(partialPerson)formMessage+=` Contact #${partialPerson} was saved, but the client record was not. Retry to finish using that contact; it will not be created twice.`;
  else if(table==='client'&&editing)formMessage+=' Contact changes may have saved before the client update failed. You can retry the form.';
  // Keep entered values on a failed save, including a partially saved client.
 }finally{
  saving=false;if(activeVersion===version){const failed=formError;render();if(failed){const target=document.getElementById('record-form');if(target)for(const [key,val] of form){const field=target.elements.namedItem(key);if(field)field.value=val;} }document.querySelector('.notice')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
 }
}
function openRecord(table,key=''){
 recordTable=table;recordKey=String(key);recordMode=key||role==='raft_counselor'?'edit':'new';formMessage='';partialPerson=null;screen='records';if(location.hash!=='#records')location.hash='records';else render();
}
async function loadData(){
 if(!session||!role)return;const activeVersion=++version;loading=true;loadError='';data=null;render();
 try{
  const results=await Promise.allSettled(Object.keys(TABLES).map(async table=>[table,await readAll(supabase,table,role)]));
  if(activeVersion!==version)return;
  const errors=results.filter(r=>r.status==='rejected');if(errors.length)throw new Error(errors.map(r=>r.reason.message).join(' · '));
  data=Object.fromEntries(results.map(r=>r.value));
 }catch(error){if(activeVersion!==version)return;loadError=error.message;data=null;}
 finally{if(activeVersion===version){loading=false;render();}}
}
async function applySession(next){
 const oldId=session?.user.id,oldRole=role;
 session=next;role=next?readRole(next.access_token):null;
 if(!next){version++;data=null;loading=false;screen='home';selectedClient=null;search='';recordKey='';partialPerson=null;formMessage='';authError='';history.replaceState(null,'',location.pathname+location.search);render();return;}
 if(!role){version++;data=null;loading=false;render();return;}
 if(oldId!==next.user.id||oldRole!==role){data=null;screen='home';recordTable=role==='raft_counselor'?'appointment':'client';recordMode=role==='raft_counselor'?'edit':'new';recordKey='';partialPerson=null;formMessage='';history.replaceState(null,'','#home');await loadData();}
}
async function signOut(){
 // Supabase's local sign-out clears this browser's persisted session.
 try{const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error;await applySession(null);}catch(error){if(session&&role){const box=document.createElement('div');box.className='notice error';box.setAttribute('role','alert');box.textContent=`Sign-out failed: ${error.message}. Please try again.`;document.getElementById('main')?.prepend(box);}else{authError=`Sign-out failed: ${error.message}`;signInView();}}
}
window.addEventListener('hashchange',()=>{if(!session||!role)return;const route=location.hash.slice(1);screen=['home','lookup','dashboard','records'].includes(route)?route:'home';render();window.scrollTo(0,0);});
supabase.auth.onAuthStateChange((event,next)=>{if(event==='INITIAL_SESSION')return;setTimeout(()=>applySession(next),0);});
try{const {data:authData,error}=await supabase.auth.getSession();if(error)throw error;await applySession(authData.session);}catch(error){authError=`Unable to restore your session. ${error.message}`;signInView();}
