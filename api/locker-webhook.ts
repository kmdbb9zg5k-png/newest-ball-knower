import {CommerceError,runtimeCommerce} from '../server/lockerCommerce.js';
export const config={api:{bodyParser:false}};
export async function readRawBody(req:any):Promise<Buffer>{
 if(Buffer.isBuffer(req.body)||typeof req.body==='string'){const body=Buffer.from(req.body);if(body.length>1024*1024)throw new Error('Payload too large');return body;}
 if(req.body)throw new Error('Raw body required');
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>1024*1024)throw new Error('Payload too large');chunks.push(bytes);}
 return Buffer.concat(chunks);
}
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).end();
 const runtime=runtimeCommerce();if(!runtime)return res.status(503).json({error:'Sandbox not configured'});
 let event;
 try{event=runtime.stripe.webhooks.constructEvent(await readRawBody(req),req.headers['stripe-signature']||'',runtime.config.webhook);}catch{return res.status(400).json({error:'Invalid webhook signature or body'});}
 try{await runtime.commerce.webhook(event);return res.status(200).json({received:true});}
 catch(error){return res.status(error instanceof CommerceError&&error.status===400?400:500).json({error:'Purchase verification incomplete; retry required'});}
}
