type Row = {id:string; announcement_id:string; user_id:string; emoji:string; created_at:string};
export const fixture={rows:[] as Row[],writes:[] as string[],delay:40,readDelay:20,fail:false,failReads:false,listeners:[] as (()=>void)[]};
Object.assign(window,{reactionFixture:fixture});
const profile={first_name:'Sample',last_name:'Leader',avatar_url:null};
const announcement={id:'fixture-announcement',title:'Revamp Rescheduled',priority:'high',created_by:'fixture-leader',created_at:'2026-09-13T00:00:00Z',org_id:'fixture-org',profiles:profile,announcement_views:[],content:'Hi team! Our Revamp session has been rescheduled to October 11.\n\nPlease confirm your availability in ServeSync.'};
class Query {
  filters:Record<string,unknown>={}; action='read'; value:Partial<Row>={}; singleRow=false;
  constructor(public table:string){}
  select(){return this;} eq(key:string,value:unknown){this.filters[key]=value;return this;} order(){return this;}
  single(){this.singleRow=true;return this;} maybeSingle(){this.singleRow=true;return this;}
  insert(value:Partial<Row>){this.action='insert';this.value=value;return this;}
  upsert(value:Partial<Row>){this.action='upsert';this.value=value;return this;}
  delete(){this.action='delete';return this;}
  async then(resolve:(result:{data:unknown;error:null|{message:string}})=>unknown,reject:(error:unknown)=>unknown){
    try {
      let data:unknown=this.table==='announcements'?{...announcement,id:this.filters.id || announcement.id}:this.table==='profiles'?(this.singleRow?profile:[]):[];
      if(this.table==='announcement_reactions') data=fixture.rows.filter(row=>Object.entries(this.filters).every(([key,value])=>row[key as keyof Row]===value)).map(row=>({...row}));
      await new Promise(r=>setTimeout(r,this.action==='read'?fixture.readDelay:fixture.delay));
      if(this.table==='announcement_reactions' && ((this.action==='read'&&fixture.failReads)||(this.action!=='read'&&fixture.fail)))return resolve({data:null,error:{message:'Fixture network failure'}});
      if(this.table==='announcement_reactions'&&this.action==='insert'){
        fixture.writes.push('insert'); const row={...this.value,id:crypto.randomUUID(),created_at:new Date().toISOString()} as Row; fixture.rows.push(row);data=row;
      }else if(this.table==='announcement_reactions'&&this.action==='delete'){
        fixture.writes.push('delete');data=Array.isArray(data)?data[0]||null:null;fixture.rows=fixture.rows.filter(row=>!Object.entries(this.filters).every(([key,value])=>row[key as keyof Row]===value));
      }
      return resolve({data,error:null});
    }catch(error){return reject(error);}
  }
}
export const supabase={from:(table:string)=>new Query(table),channel:()=>{
  const callbacks:(()=>void)[]=[];
  const channel={on(_event:string,filter:{table:string},callback:()=>void){if(filter.table==='announcement_reactions'){callbacks.push(callback);fixture.listeners.push(callback);}return channel;},subscribe(){return channel;},callbacks};return channel;
},removeChannel(channel:{callbacks:(()=>void)[]}){fixture.listeners=fixture.listeners.filter(fn=>!channel.callbacks.includes(fn));}};
