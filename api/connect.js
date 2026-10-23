// Payroll Atlas Metabase connector.
// Endpoint is pinned to the user-provided Metabase host to prevent arbitrary URL proxying.
// The browser supplies credentials per request; this handler never persists them.
// SECURITY: This app's role selector is not authenticated. Use only with a secured
// deployment until real server-side login and authorization are implemented.
const BASE='https://metabase.dev.aioapp.com';
function failure(res, status, code, message) {
  res.setHeader('Cache-Control','no-store');
  return res.status(status).json({code,error:message});
}
async function query(path,method,headers,body) {
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),15000);
  try {
    const response=await fetch(BASE+path,{
      method,headers:{Accept:'application/json',...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
      redirect:'error',cache:'no-store',signal:abort.signal
    });
    const txt=await response.text();
    if(txt.length>5000000)throw Object.assign(new Error('Metabase returned too much data.'),{code:'RESPONSE_TOO_LARGE'});
    let data;
    try{data=txt?JSON.parse(txt):{};}catch{throw Object.assign(new Error('Metabase did not return JSON.'),{code:'BAD_JSON'});}
    if(!response.ok) {
      const why=response.status===401?'Metabase rejected the credentials.':
        response.status===403?'Metabase accepted the credentials, but access to this resource is denied.':
        response.status===404?'The Metabase endpoint or saved question was not found.':
        response.status===400?'Metabase rejected this query or its parameters.':
        'Metabase responded with HTTP '+response.status+'.';
      throw Object.assign(new Error(why),{code:'METABASE_HTTP_'+response.status,providerStatus:response.status});
    }
    if(data?.status==='failed')throw Object.assign(new Error('Metabase query failed. Check native-query and database permissions.'),{code:'QUERY_FAILED'});
    return data;
  }finally{clearTimeout(timer);}
}
function cardId(value,name){
  if(value===undefined||value===null||value==='')return null;
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1||n>100000000)throw Object.assign(new Error('Invalid '+name+'.'),{code:'INVALID_CARD_ID'});
  return n;
}
function toRows(body){
  if(Array.isArray(body))return body.filter(r=>r&&typeof r==='object'&&!Array.isArray(r)).slice(0,5000);
  const raw=body?.data;
  if(!Array.isArray(raw?.rows)||!Array.isArray(raw?.cols))throw Object.assign(new Error('Metabase returned an unexpected data format.'),{code:'DATA_FORMAT'});
  return raw.rows.slice(0,5000).map(row=>Object.fromEntries(raw.cols.map((col,i)=>[
    String(col.name||col.display_name||'column_'+i).trim().toLowerCase(),row[i]
  ])));
}
function value(row,names){
  for(const name of names){const v=row[name];if(v!==undefined&&v!==null&&v!=='')return v;}
  return undefined;
}
function cleanRows(rows){return rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k.toLowerCase(),v])));}
function iso(d){
  if(typeof d!=='string'&&typeof d!=='number')return '';
  const v=String(d);
  if(/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
  if(typeof d==='number'){const date=new Date(d);return Number.isFinite(+date)?date.toISOString().slice(0,10):'';}
  return '';
}
function restaurants(rows){
  return cleanRows(rows).map(r=>({
    id:value(r,['restaurant_id','id','restaurantid','location_id']),
    name:value(r,['restaurant_name','name','restaurant','location_name']),
    frequency:value(r,['payroll_frequency','frequency','schedule_frequency','pay_frequency'])||'Not set'
  })).filter(r=>r.id!==undefined&&r.name).map(r=>({...r,id:String(r.id),name:String(r.name)}));
}
function payrollRuns(rows,known){
  return cleanRows(rows).map((r,i)=>{
    const restaurantId=value(r,['restaurant_id','restaurantid','location_id']);
    const payDate=iso(value(r,['payday','pay_date','payment_date','pay_date_time']));
    const start=iso(value(r,['period_start','period_start_date','start_date','pay_period_start']));
    const end=iso(value(r,['period_end','period_end_date','end_date','pay_period_end']));
    const approval=iso(value(r,['approval_deadline','approval','approval_date','approve_by']));
    const processing=iso(value(r,['processing_date','processing','process_date']));
    const cycle=String(value(r,['cycle','cycle_type','payroll_type'])||'Regular');
    const reason=value(r,['off_cycle_reason','offcycle_reason','reason'])||'';
    return {
      id:String(value(r,['run_id','payroll_run_id','id'])||i+1),
      restaurantId:String(restaurantId??''),
      periodStart:start,periodEnd:end,approval,processing,payday:payDate,
      cycle:/off/i.test(cycle)?'Off-Cycle':'Regular',
      status:String(value(r,['status','payroll_status'])||'Scheduled'),
      comments:reason?[{text:String(reason),cycle:'Off-Cycle',author:'Metabase',when:new Date().toISOString()}]:[]
    };
  }).filter(r=>known.has(r.restaurantId)&&r.payday&&r.approval&&r.processing);
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store, private');
  if(req.method!=='POST')return failure(res,405,'METHOD','Use POST.');
  const input=req.body||{};
  const mode=input.mode==='password'?'password':'key';
  const action=['fetch','discover'].includes(input.action)?input.action:'test';
  try {
    const headers={};
    if(mode==='key'){
      if(typeof input.key!=='string'||!input.key.trim()||input.key.length>4096)
        return failure(res,400,'MISSING_KEY','Enter your Metabase API key.');
      headers['X-API-Key']=input.key.trim();
    }else{
      if(typeof input.username!=='string'||!input.username.trim()||
         typeof input.password!=='string'||!input.password||
         input.username.length>320||input.password.length>4096)
        return failure(res,400,'MISSING_LOGIN','Enter your Metabase username and password.');
      const session=await query('/api/session','POST',{},{
        username:input.username.trim(),password:input.password
      });
      if(typeof session.id!=='string'||!session.id)
        return failure(res,502,'SESSION','Metabase did not return a login session.');
      headers['X-Metabase-Session']=session.id;
    }
    const me=await query('/api/user/current','GET',headers);
    const identity={name:me.common_name||me.first_name||me.email||'Metabase user'};
    if(action==='discover'){
      const list=await query('/api/card','GET',headers);
      if(!Array.isArray(list))return failure(res,502,'CARD_LIST','Metabase did not return a saved-question list.');
      return res.status(200).json({
        authenticated:true,identity,
        cards:list.filter(c=>c&&Number.isSafeInteger(c.id)&&typeof c.name==='string'&&!c.archived)
          .slice(0,150).map(c=>({id:c.id,name:c.name}))
      });
    }
    if(action==='test')return res.status(200).json({
      authenticated:true,identity,message:'Metabase authentication succeeded. Data permissions are checked when importing.'
    });
    const restaurantCardId=cardId(input.restaurantCardId,'restaurant question ID');
    const payrollCardId=cardId(input.payrollCardId,'payroll question ID');
    const restaurantResponse=restaurantCardId?
      await query('/api/card/'+restaurantCardId+'/query/json','POST',headers,{}):
      await query('/api/dataset','POST',headers,{database:4,type:'native',native:{query:'SELECT * FROM restaurant'}});
    const restaurantRows=toRows(restaurantResponse);
    const rs=restaurants(restaurantRows);
    let runs=[];
    if(payrollCardId){
      const payrollResponse=await query('/api/card/'+payrollCardId+'/query/json','POST',headers,{});
      runs=payrollRuns(toRows(payrollResponse),new Set(rs.map(r=>r.id)));
    }
    return res.status(200).json({
      authenticated:true,identity,
      data:{restaurants:rs,runs,buddies:[]},
      counts:{restaurantRows:restaurantRows.length,restaurants:rs.length,payrollRuns:runs.length},
      warnings:[
        ...(rs.length?'':[]),
        ...(payrollCardId?[]:['No payroll saved question selected: only restaurants can be imported.']),
        ...(restaurantRows.length&&!rs.length?['Restaurant columns not recognized; expected id/name or restaurant_id/restaurant_name.']:[])
      ]
    });
  }catch(e){
    const code=e.code|| (e.name==='AbortError'?'TIMEOUT':'NETWORK');
    const message=e.name==='AbortError'?'Metabase request timed out.':
      e.code?e.message:'Metabase could not be reached from the server. Check access restrictions.';
    return failure(res,code==='METABASE_HTTP_401'?401:code==='METABASE_HTTP_403'?403:502,code,message);
  }
}
