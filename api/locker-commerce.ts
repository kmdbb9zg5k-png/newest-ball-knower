import {CommerceError,runtimeCommerce} from '../server/lockerCommerce.js';
import {wardrobeRedemption} from '../server/wardrobeRedemption.js';
export default async function handler(req:any,res:any){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 try{
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
  const body=req.method==='POST'?(typeof req.body==='string'?JSON.parse(req.body):req.body):undefined;
  const grant=await wardrobeRedemption(token,req.method,body);
  if(grant)return res.status(200).json(grant);
  if(body?.action==='redeem')return res.status(403).json({error:'This clothing code is unavailable for your account.'});
  const runtime=runtimeCommerce();
  if(!runtime)return req.method==='GET'?res.status(200).json({available:false}):res.status(503).json({error:'Purchases are not available yet.'});
  const userId=await runtime.commerce.authenticate(token);
  if(req.method==='GET')return res.status(200).json(await runtime.commerce.state(userId));
  if(body?.action==='checkout')return res.status(200).json(await runtime.commerce.checkout(userId,String(body.sku||'')));
  if(body?.action==='equip')return res.status(200).json(await runtime.commerce.equip(userId,body.outfit));
  if(body?.action==='restore')return res.status(200).json(await runtime.commerce.state(userId));
  return res.status(400).json({error:'Unknown Locker action.'});
 }catch(error){
  if(error instanceof CommerceError)return res.status(error.status).json({error:error.message});
  return res.status(503).json({error:'The Locker could not verify your purchase. Please try again.'});
 }
}
