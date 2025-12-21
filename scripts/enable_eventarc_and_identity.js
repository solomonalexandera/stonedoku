#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');
const fetch = global.fetch || require('node-fetch');

async function main(){
  const keyPath = process.env.SA_KEY || (process.env.HOME + '/.config/sa-stonedoku.json');
  if(!fs.existsSync(keyPath)){
    console.error('service account key not found at', keyPath);
    process.exit(2);
  }
  const sa = require(keyPath);
  admin.initializeApp({credential: admin.credential.cert(sa)});
  const cert = admin.credential.cert(sa);
  let tokenResp;
  try{
    tokenResp = await cert.getAccessToken();
  }catch(e){
    console.error('getAccessToken failed', e);
    process.exit(3);
  }
  const token = tokenResp.access_token || tokenResp.accessToken || tokenResp.token || tokenResp;
  if(!token){
    console.error('no access token obtained', tokenResp);
    process.exit(4);
  }
  const projectId = sa.project_id;
  console.log('projectId', projectId);

  // get project number
  const crmUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`;
  const projResp = await fetch(crmUrl, {headers:{Authorization:`Bearer ${token}`}});
  if(!projResp.ok){
    const t = await projResp.text();
    console.error('project get failed', projResp.status, t);
    process.exit(5);
  }
  const proj = await projResp.json();
  const projectNumber = proj.projectNumber;
  console.log('projectNumber', projectNumber);

  const serviceAgent = `service-${projectNumber}@gcp-sa-eventarc.iam.gserviceaccount.com`;
  console.log('eventarc service agent:', serviceAgent);

  // enable APIs
  const toEnable = ['eventarc.googleapis.com','identitytoolkit.googleapis.com'];
  for(const api of toEnable){
    const url = `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services/${api}:enable`;
    console.log('enabling', api);
    const r = await fetch(url, {method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}});
    if(!r.ok){
      const txt = await r.text();
      console.error('enable api failed', api, r.status, txt);
    } else {
      console.log('enabled', api);
    }
  }

  // get current IAM policy
  const getPolicyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`;
  const current = await fetch(getPolicyUrl, {method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}});
  if(!current.ok){
    const txt = await current.text();
    console.error('getIamPolicy failed', current.status, txt);
    process.exit(6);
  }
  const policy = await current.json();
  policy.bindings = policy.bindings || [];

  // add binding for roles/eventarc.serviceAgent
  const role = 'roles/eventarc.serviceAgent';
  let binding = policy.bindings.find(b=>b.role===role);
  if(!binding){
    binding = {role, members:[]};
    policy.bindings.push(binding);
  }
  const member = `serviceAccount:${serviceAgent}`;
  if(!binding.members.includes(member)){
    binding.members.push(member);
    console.log('adding member to policy', member);
  } else {
    console.log('member already present in policy');
  }

  // set policy
  const setPolicyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`;
  const setResp = await fetch(setPolicyUrl, {method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, body: JSON.stringify({policy})});
  if(!setResp.ok){
    const txt = await setResp.text();
    console.error('setIamPolicy failed', setResp.status, txt);
    process.exit(7);
  }
  console.log('setIamPolicy succeeded');
  process.exit(0);
}

main().catch(e=>{console.error(e); process.exit(10)});
