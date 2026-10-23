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
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    let upstream;
    try{upstream=await fetch(url.toString(),{
      method:'GET',
      headers:{'x-api-key':key,'Accept':'application/json'},
      redirect:'error',
      signal:controller.signal
    });}finally{clearTimeout(timer);}
    if(!upstream.ok)return res.status(502).json({error:'Provider returned HTTP '+upstream.status+'. Check the API URL, key, and access permissions.'});
    const type=upstream.headers.get('content-type')||'';
    if(!type.toLowerCase().includes('json'))return res.status(502).json({error:'Provider did not return JSON. Check that the URL is a JSON API endpoint.'});
    const raw=await upstream.text();
    if(raw.length>5000000)return res.status(502).json({error:'Provider response is too large.'});
    let data;try{data=JSON.parse(raw);}catch{return res.status(502).json({error:'Provider returned invalid JSON.'});}
    return res.status(200).json({data});
  }catch(err){
    return res.status(502).json({error:err?.name==='AbortError'?'Provider request timed out.':'Could not contact the provider. Check its HTTPS URL and access rules.'});
  }
}
