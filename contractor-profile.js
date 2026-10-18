/* Profile data and contact actions are rendered safely by ContractorSupport. */
document.addEventListener('DOMContentLoaded',()=>ContractorSupport.profile());
function switchTab(tabId, item) {
  document.querySelectorAll('.tab-content').forEach(section=>{section.style.display=section.id===tabId?'block':'none';});
  document.querySelectorAll('.profile-tabs span').forEach(tab=>tab.classList.toggle('active',tab===item));
}
