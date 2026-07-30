const views = [...document.querySelectorAll('.content')];
const navItems = [...document.querySelectorAll('.nav-item[data-view]')];
const title = document.querySelector('#page-title');
const toast = document.querySelector('#toast');
const labels = {command:'Command center',agents:'Agent roster',calendar:'Competition calendar',eligibility:'Eligibility desk',standings:'Standings & rankings',comms:'Communications',championships:'Championship ops'};
let toastTimer;
function notify(message){ toast.textContent=message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2600); }
function showView(name){ views.forEach(v=>v.classList.toggle('hidden', v.id !== `view-${name}`)); navItems.forEach(n=>n.classList.toggle('active', n.dataset.view===name)); title.textContent=labels[name]; window.scrollTo({top:0,behavior:'smooth'}); }
navItems.forEach(item=>item.addEventListener('click',()=>showView(item.dataset.view)));
document.querySelectorAll('[data-view-link]').forEach(el=>el.addEventListener('click',()=>showView(el.dataset.viewLink)));
document.querySelector('#brief-btn')?.addEventListener('click',()=>notify('Daily brief drafted and added to your approval queue.'));
document.querySelector('#ask-agent')?.addEventListener('click',()=>notify('Atlas is ready. Try: “What needs my attention today?”'));
document.querySelector('#run-agents')?.addEventListener('click',()=>notify('Operating brief started across all eight workstreams.'));
document.querySelector('#pause-agents')?.addEventListener('click',()=>notify('Pause request drafted. Existing runs will stop at their next safe checkpoint.'));
document.querySelectorAll('.approve-btn').forEach(btn=>btn.addEventListener('click',()=>notify('Review opened — Atlas has prepared the evidence and recommendation.')));
document.querySelectorAll('.primary-btn').forEach(btn=>{ if(!btn.id && !btn.closest('.draft-actions')) btn.addEventListener('click',()=>notify('Atlas started the workflow. You will be notified when a decision is ready.')); });
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{btn.parentElement.querySelectorAll('.filter').forEach(b=>b.classList.remove('active'));btn.classList.add('active');notify(`${btn.textContent.trim()} filter applied.`);}));
document.querySelectorAll('.checklist input').forEach(box=>box.addEventListener('change',()=>notify(box.checked?'Checklist item marked complete.':'Checklist item reopened.')));
