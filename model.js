export const ROLE_NAMES = {raft_admin:'Admin', raft_scheduler:'Scheduler', raft_counselor:'Counselor'};
// PostgreSQL folds the unquoted identifiers in the supplied DDL to lowercase.
export const TABLES = {
 person: {label:'Person', keys:['personid'], columns:'personid,firstname,lastname,address,city,state,zip,phone,email', fields:[['firstname','First name','text',50],['lastname','Last name','text',50],['address','Street address','text',50],['city','City','text',50],['state','State','text',2],['zip','ZIP','text',10],['phone','Phone','text',14],['email','Email','email',100]]},
 client: {label:'Client',keys:['clientid'],columns:'clientid,foundout,remindermethod,referredby',fields:[['foundout','How they found RAFT','text',50],['remindermethod','Reminder method','text',50],['referredby','Referred by','ref','client']]},
 counselor: {label:'Counselor',keys:['counselorid'],columns:'counselorid,degreesuffix',fields:[['counselorid','Person','ref','person',true],['degreesuffix','Degree suffix','text',50]]},
 employee: {label:'Employee',keys:['employeeid'],columns:'employeeid,datehired,supervisorid',fields:[['employeeid','Person','ref','person',true],['datehired','Date hired','date'],['wage','Hourly wage','number',null],['supervisorid','Supervisor','ref','employee',true]]},
 family_member: {label:'Family member',keys:['memberid'],columns:'memberid',fields:[['memberid','Person','ref','person',true]]},
 room: {label:'Room',keys:['roomnumber'],columns:'roomnumber,roomname',fields:[['roomnumber','Room number','number',null,true],['roomname','Room name','text',50]]},
 appointment: {label:'Appointment',keys:['appointmentid'],columns:'appointmentid,appointmenttime,duration,counselorid,employeeid,roomnumber',fields:[['appointmenttime','Appointment time','datetime-local'],['duration','Duration (minutes)','number'],['counselorid','Counselor','ref','counselor',true],['employeeid','Scheduling employee','ref','employee',true],['roomnumber','Room','ref','room',true],['notes','Appointment notes','textarea',3000]]},
 scheduledfor: {label:'Appointment participation',keys:['appointmentid','clientid'],columns:'appointmentid,clientid,kept',fields:[['appointmentid','Appointment','ref','appointment',true],['clientid','Client','ref','client',true],['assignment','Assignment','textarea',2000],['kept','Attendance','boolean']]},
 family: {label:'Family',keys:['familyid'],columns:'familyid,familyname,datefounded',fields:[['familyname','Family name','text',100],['datefounded','Date founded','date']]},
 member_in_family: {label:'Family membership',keys:['familyid','memberid'],columns:'familyid,memberid,datejoined',fields:[['familyid','Family','ref','family',true],['memberid','Family member','ref','family_member',true],['datejoined','Date joined','date']]},
 role: {label:'Family role',keys:['roleid'],columns:'roleid,rolename',fields:[['rolename','Role name','text',50]]},
 member_role: {label:'Membership role',keys:['familyid','memberid','roleid'],columns:'familyid,memberid,roleid',fields:[['familyid','Family','ref','family',true],['memberid','Family member','ref','family_member',true],['roleid','Family role','ref','role',true]]}
};
export function columnsFor(table, role) {
 let cols=TABLES[table].columns;
 if (table==='employee' && role==='raft_admin') cols+=',wage';
 if (table==='appointment' && role!=='raft_scheduler') cols+=',notes';
 if (table==='scheduledfor' && role!=='raft_scheduler') cols+=',assignment';
 return cols;
}
export function editableTables(role) {
 if(role==='raft_admin') return Object.keys(TABLES);
 if(role==='raft_scheduler') return ['person','client','room','appointment','scheduledfor'];
 if(role==='raft_counselor') return ['appointment','scheduledfor'];
 return [];
}
export function editableFields(table,role,editing) {
 if(!editableTables(role).includes(table)) return [];
 let fields=TABLES[table].fields;
 if(role==='raft_counselor') return editing ? fields.filter(f => table==='appointment' ? f[0]==='notes' : ['assignment','kept'].includes(f[0])) : [];
 return fields.filter(f=> !(role==='raft_scheduler' && ['notes','assignment','wage'].includes(f[0])) && !(editing && TABLES[table].keys.includes(f[0])));
}
export function readRole(token) {
 try { const part=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); const role=JSON.parse(atob(part)).role; return ROLE_NAMES[role] ? role : null; } catch { return null; }
}
export async function readAll(db,table,role) {
 const rows=[];
 for(;;) {
  let query=db.from(table).select(columnsFor(table,role),{count:'exact'});
  for(const key of TABLES[table].keys) query=query.order(key,{ascending:true});
  const start=rows.length;
  const {data,error,count}=await query.range(start,start+499);
  if(error) throw new Error(`${TABLES[table].label}: ${error.message}`);
  rows.push(...data);
  if(count!=null ? rows.length>=count : data.length<500) return rows;
  if(!data.length) throw new Error(`${TABLES[table].label}: records changed while loading. Please refresh.`);
 }
}
