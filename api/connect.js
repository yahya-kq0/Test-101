// Server-side payroll provider proxy. Configure PAYROLL_PROVIDER_URL on Vercel.
// The API key is supplied per request, never stored in the dashboard.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const url=process.env.PAYROLL_PROVIDER_URL;
  if(!url)return res.status(503).json({error:'Payroll provider address is not configured on the server. Set PAYROLL_PROVIDER_URL in Vercel project settings.'});
  let parsed;
  try{parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Invalid URL');}
  catch{return res.status(500).json({error:'Server provider URL must be a valid HTTPS address.'});}
  const key=req.body?.key;
  if(typeof key!=='string'||!key.trim()||key.length>4096)return res.status(400).json({error:'Enter a valid API key.'});
  const header=process.env.PAYROLL_API_HEADER||'x-api-key';
  if(!/^(x-api-key|api-key|authorization)$/i.test(header))return res.status(500).json({error:'Invalid server authentication header configuration.'});
  const auth=header.toLowerCase()==='authorization'?(process.env.PAYROLL_API_PREFIX==='Bearer'?'Bearer ':'')+key:key;
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    let upstream;
    try{upstream=await fetch(parsed.toString(),{method:'GET',headers:{[header]:auth,'Accept':'application/json'},redirect:'error',signal:controller.signal});}
    finally{clearTimeout(timeout);}
    if(!upstream.ok)return res.status(502).json({error:'Provider request failed (HTTP '+upstream.status+'). Confirm the key and provider permissions.'});
    const type=upstream.headers.get('content-type')||'';
    if(!type.includes('json'))return res.status(502).json({error:'Provider did not return JSON data.'});
    const raw=await upstream.text();
    if(raw.length>5000000)return res.status(502).json({error:'Provider response is too large.'});
    const data=JSON.parse(raw);
    return res.status(200).json({data});
  }catch(err){
    return res.status(502).json({error:err?.name==='AbortError'?'Provider timed out.':'Unable to contact payroll provider. Check its server URL and API permissions.'});
  }
}
