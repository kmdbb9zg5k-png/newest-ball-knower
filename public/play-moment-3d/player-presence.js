// Cosmetic upper-body motion only. Never moves roots, feet, ball or contacts.
export function playerPresence(player,phase,time){
 if(!Number.isFinite(time)||!['pre','dead'].includes(phase)||player.fallen||player.engaged||Math.hypot(player.vx||0,player.vz||0)>.2)return {breath:0,scan:0,nod:0};
 const seed=((player.index||0)*37+(player.team||0)*11)%29,offset=seed*.47;
 const breath=Math.sin(time*(1.45+seed*.007)+offset)*.012;
 const scan=Math.sin(time*.43+offset)*((player.role==='QB'||player.role==='LB')?.085:.04);
 return {breath,scan,nod:Math.sin(time*.71+offset)*.009};
}
