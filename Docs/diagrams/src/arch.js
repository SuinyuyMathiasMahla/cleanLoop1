// CleanLoop cloud architecture, AWS diagram conventions: AWS Cloud > Region groups, official icons, numbered flows.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', 'awsicons');
const u = (p) => 'file:///' + path.join(ROOT, p).replace(/\\/g, '/');
const S = 'Architecture-Service-Icons_07312026/';
const I = {
  amplify: u(S + 'Arch_Front-End-Web-Mobile/48/Arch_AWS-Amplify_48.svg'),
  cognito: u(S + 'Arch_Security-Identity/48/Arch_Amazon-Cognito_48.svg'),
  apigw: u(S + 'Arch_Networking-Content-Delivery/48/Arch_Amazon-API-Gateway_48.svg'),
  waf: u(S + 'Arch_Security-Identity/48/Arch_AWS-WAF_48.svg'),
  lambda: u(S + 'Arch_Compute/48/Arch_AWS-Lambda_48.svg'),
  s3: u(S + 'Arch_Storage/48/Arch_Amazon-Simple-Storage-Service_48.svg'),
  ddb: u(S + 'Arch_Databases/48/Arch_Amazon-DynamoDB_48.svg'),
  sqs: u(S + 'Arch_Application-Integration/48/Arch_Amazon-Simple-Queue-Service_48.svg'),
  eb: u(S + 'Arch_Application-Integration/48/Arch_Amazon-EventBridge_48.svg'),
  sns: u(S + 'Arch_Application-Integration/48/Arch_Amazon-Simple-Notification-Service_48.svg'),
  ses: u(S + 'Arch_Business-Applications/48/Arch_Amazon-Simple-Email-Service_48.svg'),
  rek: u(S + 'Arch_Artificial-Intelligence/48/Arch_Amazon-Rekognition_48.svg'),
  bedrock: u(S + 'Arch_Artificial-Intelligence/48/Arch_Amazon-Bedrock_48.svg'),
  cw: u(S + 'Arch_Management-Tools/48/Arch_Amazon-CloudWatch_48.svg'),
  sm: u(S + 'Arch_Security-Identity/48/Arch_AWS-Secrets-Manager_48.svg'),
  kms: u(S + 'Arch_Security-Identity/48/Arch_AWS-Key-Management-Service_48.svg'),
  iam: u(S + 'Arch_Security-Identity/48/Arch_AWS-Identity-and-Access-Management_48.svg'),
  cdk: u(S + 'Arch_Developer-Tools/48/Arch_AWS-Cloud-Development-Kit_48.svg'),
  mobile: u('Resource-Icons_07312026/Res_General-Icons/Res_48_Light/Res_Mobile-client_48_Light.svg'),
  client: u('Resource-Icons_07312026/Res_General-Icons/Res_48_Light/Res_Client_48_Light.svg'),
  internet: u('Resource-Icons_07312026/Res_General-Icons/Res_48_Light/Res_Internet-alt1_48_Light.svg'),
  globe: u('Resource-Icons_07312026/Res_General-Icons/Res_48_Light/Res_Globe_48_Light.svg'),
  cloud: u('Architecture-Group-Icons_07312026/AWS-Cloud-logo_32.svg'),
  region: u('Architecture-Group-Icons_07312026/Region_32.svg'),
};
const K = { esp: '#3A2A22', body: '#5E524B', muted: '#7A6C63', card: '#FDFBF9', terra: '#B5653A', clay: '#8A6A56', line: '#DCD2CA', lane: '#F5F0EB' };
const W = 1664, H = 700;
const css = `
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;background:${K.card};font-family:'Inter Tight',Arial,sans-serif;color:#232F3E;position:relative;overflow:hidden}
.n{position:absolute;width:120px;display:flex;flex-direction:column;align-items:center;text-align:center;font-size:12.5px;line-height:1.15;gap:3px}
.n img{width:40px;height:40px}
.n small{font-size:11px;color:${K.muted}}
.n.later{opacity:.45}
.tag{font-size:10px;font-weight:700;letter-spacing:.8px;color:${K.terra};border:1px dashed ${K.terra};border-radius:8px;padding:0 5px;background:#fff}
.grp{position:absolute;border:1.5px dashed #879196;border-radius:4px}
.grp p{position:absolute;left:8px;top:4px;font-size:12px;font-weight:600;color:#545B64}
.badge{position:absolute;width:20px;height:20px;border-radius:50%;background:${K.esp};color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.lab{position:absolute;font-size:11px;color:${K.muted};white-space:nowrap;background:${K.card};padding:0 2px}
svg.edges{position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:visible}
`;
const n = (id, cx, y, icon, label, sub, later) => `<div id="${id}" class="n${later ? ' later' : ''}" style="left:${cx - 60}px;top:${y}px"><img id="${id}-i" src="${I[icon]}"><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}${later ? `<span class="tag">${later}</span>` : ''}</div>`;
const grp = (x, y, w, h, label) => `<div class="grp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><p>${label}</p></div>`;
const badge = (k, x, y) => `<div class="badge" style="left:${x - 10}px;top:${y - 10}px">${k}</div>`;

const body = [
  // AWS Cloud group (solid dark border, logo top-left) and Region group (dashed teal, region icon)
  `<div style="position:absolute;left:170px;top:8px;width:1180px;height:684px;border:2px solid #232F3E"></div><img src="${I.cloud}" style="position:absolute;left:170px;top:8px;width:32px;height:32px"><p style="position:absolute;left:208px;top:15px;font-size:13px;font-weight:600">AWS Cloud</p>`,
  `<div style="position:absolute;left:186px;top:46px;width:1148px;height:630px;border:1.5px dashed #147EBA"></div><img src="${I.region}" style="position:absolute;left:186px;top:46px;width:28px;height:28px"><p style="position:absolute;left:220px;top:51px;font-size:12.5px;font-weight:600;color:#147EBA">Region: us-east-1</p>`,
  grp(200, 84, 150, 450, 'Edge and identity'),
  grp(362, 84, 180, 450, 'API functions'),
  grp(554, 84, 170, 450, 'Data'),
  grp(736, 84, 392, 450, 'Asynchronous processing'),
  grp(1140, 84, 180, 450, 'AI services'),
  grp(200, 552, 1120, 112, 'Operations and security (every service)'),
  // clients and external systems sit outside the AWS Cloud
  n('admin', 84, 104, 'client', 'Admin portal', 'web'),
  n('citizen', 84, 244, 'mobile', 'Citizen app', 'Expo, offline queue'),
  n('crew', 84, 384, 'mobile', 'Crew app', 'Expo'),
  `<p style="position:absolute;left:24px;top:470px;width:120px;text-align:center;font-size:11px;color:${K.muted}">Users</p>`,
  n('geo', 1436, 118, 'globe', 'Geocoding API', 'external'),
  n('sms', 1436, 262, 'internet', 'SMS gateway', 'external, key in Secrets Manager'),
  // edge and identity
  n('amplify', 275, 104, 'amplify', 'Amplify Hosting', 'admin portal + CDN'),
  n('cognito', 275, 214, 'cognito', 'Amazon Cognito', 'SMS code or email login'),
  n('apigw', 275, 324, 'apigw', 'API Gateway', 'REST, JWT, throttling'),
  n('waf', 275, 434, 'waf', 'AWS WAF', 'attaches to API Gateway', 'LATER'),
  // API functions
  n('fReports', 452, 100, 'lambda', 'Reports API'),
  n('fAuth', 452, 186, 'lambda', 'Auth trigger', 'Cognito hooks'),
  n('fTasks', 452, 272, 'lambda', 'Tasks API'),
  n('fCrew', 452, 358, 'lambda', 'Crew and admin API'),
  n('fNotif', 452, 444, 'lambda', 'Notifications API'),
  // data
  n('s3', 639, 104, 's3', 'Amazon S3', 'report and proof photos'),
  n('ddb', 639, 270, 'ddb', 'Amazon DynamoDB', 'reports, tasks, users; geohash index'),
  // asynchronous processing
  n('sqs', 790, 104, 'sqs', 'Processing queue', 'Amazon SQS'),
  n('dlq', 790, 222, 'sqs', 'Dead-letter queue', 'failed messages'),
  n('pipe', 930, 104, 'lambda', 'Pipeline worker', 'validate, geocode, dedupe, prioritise, assign'),
  n('bus', 930, 276, 'eb', 'Event bus', 'Amazon EventBridge'),
  n('notifier', 1064, 276, 'lambda', 'Notifier'),
  n('sns', 992, 400, 'sns', 'Amazon SNS', 'mobile push'),
  n('ses', 1090, 400, 'ses', 'Amazon SES', 'admin email'),
  n('sched', 790, 400, 'eb', 'Scheduler', 'EventBridge, every minute'),
  n('sla', 905, 400, 'lambda', 'SLA watchdog', 'and monthly rollover'),
  // AI services
  n('rek', 1229, 100, 'rek', 'Amazon Rekognition', 'labels, moderation'),
  n('aim', 1229, 248, 'lambda', 'AI Intelligence Module', 'private API', 'R2'),
  n('bedrock', 1229, 396, 'bedrock', 'Amazon Bedrock', 'assistant, narratives', 'R3+'),
  // operations band
  n('cw', 290, 572, 'cw', 'CloudWatch', 'logs, metrics, alarms'),
  n('sm', 480, 572, 'sm', 'Secrets Manager', 'SMS provider key'),
  n('kms', 670, 572, 'kms', 'AWS KMS', 'encryption keys'),
  n('iam', 860, 572, 'iam', 'AWS IAM', 'least-privilege roles'),
  n('cdk', 1050, 572, 'cdk', 'AWS CDK', 'deployed by GitHub Actions'),
  // numbered steps
  `<div style="position:absolute;left:1366px;top:388px;width:290px;font-size:11.5px;line-height:1.38;color:${K.body}"><p style="font-weight:700;color:${K.esp};font-size:12.5px;margin-bottom:4px">How a report flows</p>` +
  [['1', 'Apps sign in with Cognito and get a token'], ['2', 'App creates the report; API returns upload links'], ['3', 'Photos go straight from the phone to S3'], ['4', 'App calls submit; the report is queued once'], ['5', 'Worker labels images, geocodes, checks duplicates, assigns a crew'], ['6', 'Assignment event triggers SMS and push'], ['7', 'Scheduler escalates tasks past their SLA']].map(([k, t]) => `<div style="display:flex;gap:6px;margin-bottom:2px"><span style="flex-shrink:0;width:16px;height:16px;border-radius:50%;background:${K.esp};color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px">${k}</span><span>${t}</span></div>`).join('') +
  `<p style="margin-top:6px;color:${K.muted}">Faded with a tag = a later release.</p></div>`,
].join('\n');

// edges: [points] with style; badges placed separately
const E = (pts, o = {}) => ({ pts, ...o });
const edges = [
  E([[160, 100], [160, 420]], { head: false }),                                  // users bus
  E([[150, 126], [160, 126]], { head: false }), E([[150, 266], [160, 266]], { head: false }), E([[150, 406], [160, 406]], { head: false }),
  E([[160, 236], [255, 236]]),                                                   // 1 apps -> Cognito
  E([[160, 346], [255, 346]]),                                                   // 2 apps -> API Gateway
  E([[160, 100], [160, 76], [639, 76], [639, 104]]),                             // 3 apps -> S3 direct
  E([[255, 126], [150, 126]], { dash: true, label: 'hosts', lp: [190, 112] }),   // Amplify hosts portal
  E([[275, 322], [275, 298]], { dash: true, label: 'JWT check', lp: [280, 302] }),
  E([[275, 434], [275, 402]], { dash: true, faded: true }),                      // WAF attaches
  E([[295, 236], [432, 208]]),                                                   // Cognito -> auth trigger
  E([[295, 346], [362, 346]]),                                                   // API GW -> API functions group
  E([[542, 300], [619, 292]]),                                                   // API functions -> DynamoDB
  E([[472, 122], [548, 122], [548, 190], [748, 190], [748, 126], [770, 126]]),   // 4 Reports -> SQS
  E([[810, 126], [910, 126]]),                                                   // 5 SQS -> worker
  E([[790, 180], [790, 222]], { label: 'after retries', lp: [796, 190] }),       // SQS -> DLQ
  E([[910, 120], [860, 120], [860, 304], [659, 304]]),                           // worker -> DynamoDB
  E([[950, 120], [1209, 120]]),                                                  // worker -> Rekognition
  E([[950, 134], [1132, 134], [1132, 176], [1356, 176], [1356, 138], [1414, 138]]),          // worker -> geocoding
  E([[930, 192], [930, 276]]),                                                   // 6 worker -> event bus
  E([[950, 298], [1044, 298]]),                                                  // bus -> notifier
  E([[1064, 318], [1064, 350], [992, 350], [992, 400]]),                       // notifier -> SNS
  E([[1064, 350], [1090, 350], [1090, 400]]),                                    // notifier -> SES
  E([[1084, 298], [1134, 298], [1134, 366], [1356, 366], [1356, 282], [1414, 282]]),          // notifier -> SMS gateway
  E([[810, 422], [885, 422]]),                                                   // 7 scheduler -> SLA watchdog
  E([[905, 400], [905, 372], [868, 372], [868, 296], [908, 296]]),                           // SLA -> event bus
  E([[905, 482], [905, 520], [639, 520], [639, 354]]),                           // SLA -> DynamoDB
  E([[950, 112], [1132, 112], [1132, 248], [1209, 270]], { dash: true, faded: true }), // worker -> AIM (R2)
];
const badges = [badge(1, 205, 236), badge(2, 205, 346), badge(3, 400, 76), badge(4, 650, 190), badge(5, 860, 126 - 0) , badge(6, 930, 236), badge(7, 848, 422)];
const router = `
function draw(edges){const NS='http://www.w3.org/2000/svg';const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','edges');
 svg.innerHTML='<defs><marker id="h" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#232F3E"/></marker></defs>';
 for(const e of edges){const pl=document.createElementNS(NS,'polyline');pl.setAttribute('points',e.pts.map(q=>q.join(',')).join(' '));pl.setAttribute('fill','none');pl.setAttribute('stroke','#232F3E');pl.setAttribute('stroke-width','1.4');pl.setAttribute('stroke-linejoin','round');
  if(e.dash)pl.setAttribute('stroke-dasharray','5 4');if(e.faded)pl.setAttribute('opacity','.4');if(e.head!==false)pl.setAttribute('marker-end','url(#h)');svg.appendChild(pl);
  if(e.label){const d=document.createElement('p');d.className='lab';d.textContent=e.label;d.style.left=e.lp[0]+'px';d.style.top=e.lp[1]+'px';document.body.appendChild(d);}}
 document.body.insertBefore(svg,document.querySelector('.n'));}
`;
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..700&display=block" rel="stylesheet"><style>${css}</style></head><body>
${body}
${badges.join('\n')}
<script>${router}
document.fonts.ready.then(()=>{draw(${JSON.stringify(edges)});document.title='ready';});</script></body></html>`;
fs.writeFileSync(path.join(__dirname, 'arch.html'), html);
console.log('ok');
