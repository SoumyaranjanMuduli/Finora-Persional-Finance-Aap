window.MFPNotifications = {
  async list(limit=30) { const {data,error}=await mfpSupabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(limit); return {data:data||[],error}; },
  async markRead(id) { return mfpSupabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id); },
  async markAllRead() { const {data:{user}}=await mfpSupabase.auth.getUser(); if(!user)return {error:new Error('Session expired')}; return mfpSupabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null); }
};
