import type { Express } from "express";
import { z } from "zod";
import { DB_ENABLED, pool } from "./db";

const body=z.object({kind:z.enum(["feedback","accessibility","privacy","speak-up"]),message:z.string().trim().min(10).max(4000),contactEmail:z.string().trim().email().max(254).optional().or(z.literal(""))});
const hits=new Map<string,{n:number;reset:number}>();

export function registerTrustRoutes(app:Express){
app.post("/api/trust/report",async(req,res)=>{
const now=Date.now(),key=req.ip||"unknown",h=hits.get(key);
if(h&&h.reset>now&&h.n>=5)return res.status(429).json({message:"Too many submissions. Please try again later."});
hits.set(key,h&&h.reset>now?{n:h.n+1,reset:h.reset}:{n:1,reset:now+15*60*1000});
const parsed=body.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:"Please check the report fields."});
if(!DB_ENABLED||!pool)return res.status(503).json({message:"Reporting channel is temporarily unavailable."});
const {kind,message,contactEmail}=parsed.data;
try{const r=await pool.query("INSERT INTO trust_reports (kind,message,contact_email) VALUES ($1,$2,$3) RETURNING id",[kind,message,contactEmail||null]);return res.status(201).json({received:true,reference:`PP-${r.rows[0].id}`})}catch{return res.status(500).json({message:"Unable to store the report right now."})}
});
}
