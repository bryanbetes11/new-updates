import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { NotificationActivityView } from '../../src/pages/leadership/NotificationActivity';
import '../../src/index.css';
const group = {group_id:'fixture',title:'Revamp Session reminder',notification_type:'event_reminder',created_at:'2026-09-09T00:00:00Z',recipient_count:3,opened_count:2};
const recipients = [
  {notification_id:'one',user_id:'one',profiles:{first_name:'Alex',last_name:'Example'},push_status:'sent',is_read:true,push_opened_at:'2026-09-09T00:14:00Z',bell_opened_at:null,page_opened_at:null},
  {notification_id:'two',user_id:'two',profiles:{first_name:'Sam',last_name:'Example'},push_status:'no_subscription',is_read:true,push_opened_at:null,bell_opened_at:'2026-09-09T00:20:00Z',page_opened_at:null},
  {notification_id:'three',user_id:'three',profiles:{first_name:'Chris',last_name:'Example'},push_status:'sent',is_read:true,push_opened_at:null,bell_opened_at:null,page_opened_at:null},
];
function Fixture() {
  const [selected,setSelected]=useState(null);
  const [error,setError]=useState(null);
  return <MemoryRouter initialEntries={['/admin/notification-activity']}><main style={{minHeight:'100vh',background:'#09090b',padding:16,color:'white'}}>
    <p>Isolated QA — synthetic members only</p><button onClick={()=>setError('Could not load notification activity. Check your connection and try again.')}>Simulate failure</button>
    <NotificationActivityView groups={[group]} selected={selected} recipients={recipients} loading={false} error={error} page={0} onPage={()=>{}} onRefresh={()=>setError(null)} onSelect={setSelected}/>
  </main></MemoryRouter>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
