// Payroll Atlas API connector. URL and X-API-Key are supplied per request,
// never written to repository files, browser storage, or server logs.
// IMPORTANT: This route requires real server-side admin authentication before public production use.
import dns from 'node:dns/promises';
import net from 'node:net';

function privateAddress(ip) {
  if (net.isIP(ip) === 4) {
    const p=ip.split('.').map(Number);
    return p[0]===0||p[0]===10||p[0]===127||p[0]>=224||
      (p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||
      (p[0]===192&&p[1]===168)||(p[0]===100&&p[1]>=64&&p[1]<=127)||
      (p[0]===192&&p[1]===0)||(p[0]===198&&(p[1]===18||p[1]===19));
  }
  if (net.isIP(ip) === 6) {
    const v=ip.toLowerCase();
    return v==='::1'||v==='::'||v.startsWith('fc')||v.startsWith('fd')||
      v.startsWith('fe8')||v.startsWith('fe9')||v.startsWith('fea')||
      v.startsWith('feb')||v.startsWith('::ffff:');
  }
  return true;
}
async function validProviderUrl(raw) {
  if(typeof raw!=='string'||raw.length>2000)throw Error('Enter a valid provider HTTPS URL.');
  let url;try{url=new URL(raw);}catch{throw Error('Enter a valid provider HTTPS URL.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||
     url.hash||!url.hostname.includes('.')||/\.(local|internal|localhost|test|invalid)$/i.test(url.hostname)||
     net.isIP(url.hostname))throw Error('Only public HTTPS provider endpoints are supported.');
  const addresses=await dns.lookup(url.hostname,{all:true});
  if(!addresses.length||addresses.some(a=>privateAddress(a.address)))throw Error('Provider address cannot resolve to a private network.');
  return url;
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, private');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const key=req.body?.key;
  if(typeof key!=='string'||!key.trim()||key.length>4096)return res.status(400).json({error:'Enter your X-API-Key.'});
  let url;
  try{url=await validProviderUrl(req.body?.url);}
  catch(err){return res.status(400).json({error:err.message||'Invalid provider URL.'});}
  // This integration is intentionally scoped to the user's supplied Metabase instance
  // and the read-only restaurant query; do not accept arbitrary SQL from the browser.
  if(url.hostname!=='metabase.dev.aioapp.com' || url.pathname!=='/api/dataset')
    return res.status(400).json({error:'Use the Metabase dataset URL: https://metabase.dev.aioapp.com/api/dataset'});
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    let upstream;
    try{upstream=await fetch(url.toString(),{
      method:'POST',
      headers:{'x-api-key':key,'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({database:4,type:'native',native:{query:'SELECT * FROM restaurant'}}),
      redirect:'error',
      signal:controller.signal
    });}finally{clearTimeout(timer);}
    if(!upstream.ok)return res.status(502).json({error:'Provider returned HTTP '+upstream.status+'. Check the API URL, key, and access permissions.'});
    const type=upstream.headers.get('content-type')||'';
    if(!type.toLowerCase().includes('json'))return res.status(502).json({error:'Provider did not return JSON. Check that the URL is a JSON API endpoint.'});
    const raw=await upstream.text();
    if(raw.length>5000000)return res.status(502).json({error:'Provider response is too large.'});
    let data;try{data=JSON.parse(raw);}catch{return res.status(502).json({error:'Provider returned invalid JSON.'});}
    if(data.status==='failed'||data.error)return res.status(502).json({error:'Metabase query failed: '+String(data.error||'query not permitted').slice(0,250)});
    const cols=data.data?.cols||[];
    const rows=data.data?.rows||[];
    if(!Array.isArray(cols)||!Array.isArray(rows))return res.status(502).json({error:'Metabase did not return data.cols and data.rows.'});
    const objects=rows.map(row=>Object.fromEntries(cols.map((c,i)=>[String(c.name||c.display_name||'column_'+i).toLowerCase(),row[i]])));
    const find=(obj,...names)=>{for(const name of names){const value=obj[name];if(value!==null&&value!==undefined&&value!=='')return value;}return undefined};
    const restaurants=objects.map(o=>({
      id:find(o,'id','restaurant_id','restaurantid'),
      name:find(o,'name','restaurant_name','restaurantname','location_name'),
      frequency:find(o,'payroll_frequency','frequency')||'Not set'
    })).filter(r=>r.id!==undefined&&r.name!==undefined);
    return res.status(200).json({data:{restaurants,runs:[],buddies:[]},metadata:{returnedRows:rows.length,mappedRestaurants:restaurants.length,columns:cols.map(c=>c.name),source:'Metabase database 4 / restaurant'}});
  }catch(err){
    return res.status(502).json({error:err?.name==='AbortError'?'Provider request timed out.':'Could not contact the provider. Check its HTTPS URL and access rules.'});
  }
}
