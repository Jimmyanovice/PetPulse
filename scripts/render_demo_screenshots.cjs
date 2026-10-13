// Render documentation from explicitly fictional fixtures without writing to the database.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const pet={id:999999,name:'团子（虚构演示）',species:'cat',breed:'英国短毛猫',birth_date:'2023-03-18',sex:'female',weight_kg:4.5,neutered:true,allergies:null,chronic_conditions:null,current_medications:null};
 const now=new Date().toISOString();
 const logs=[{id:9001,pet_id:pet.id,content:'【虚构案例】今天只吃了平时一半，饮水正常，精神尚可，没有呕吐。',log_type:'daily',logged_at:now,structured_data:{appetite:'reduced',water_intake:'normal',energy:'normal'}}];
 const summary='近期记录提示食欲减少，现有资料不足以确定原因。建议记录进食量、精神和排泄变化；持续或加重时联系兽医。';
 const report={id:9002,pet_id:pet.id,risk_level:'medium',created_at:now,summary:{log_count:1,analysis:{summary,actions_now:['记录实际进食量与症状时间线。','持续拒食或出现其他异常时联系兽医。']}},report_content:summary+'\n\n辅助观察不能替代兽医诊断。',citations:[]};
 const messages=[{id:9101,role:'user',content:'它今天吃得少，需要留意什么？',citations:[]},{id:9102,role:'assistant',risk_level:'medium',content:summary+'\n\n建议观察\n• 饮水、排泄与精神是否变化\n• 是否出现呕吐或其他异常\n\n辅助观察不能替代兽医诊断。',citations:[{source_title:'AAHA/AAFP Feline Life Stage Guidelines',source_url:'https://www.aaha.org/resources/2021-aaha-aafp-feline-life-stage-guidelines/',excerpt:'食欲变化需结合持续时间、体重、饮水、排泄和行为变化判断。'}]}];
 const session={id:9201,pet_id:pet.id,messages};
 await page.route('**/api/pets**',async route=>{
  const pathname=new URL(route.request().url()).pathname;
  let payload=[];
  if(pathname==='/api/pets')payload=[pet];
  else if(pathname.endsWith('/logs'))payload=logs;
  else if(pathname.endsWith('/reports'))payload=[report];
  else if(pathname.endsWith('/chat/sessions'))payload=[session];
  else if(pathname.endsWith('/chat/sessions/9201'))payload=session;
  await route.fulfill({json:payload});
 });
 const output=path.resolve('docs/images');fs.mkdirSync(output,{recursive:true});
 await page.goto('http://127.0.0.1:8001/?pet_id='+pet.id);
 await page.waitForSelector('#report-result:not([hidden])');
 await page.screenshot({path:path.join(output,'journal.png'),fullPage:true});
 await page.locator('#consult-ai-button').click();
 await page.waitForSelector('.message.assistant');
 await page.screenshot({path:path.join(output,'conversation.png'),fullPage:true});
 await page.locator('#knowledge-link').click();
 await page.waitForSelector('#knowledge-view .card');
 await page.locator('#filter').fill('食欲');
 await page.screenshot({path:path.join(output,'knowledge.png'),fullPage:true});
 await browser.close();console.log('Documentation screenshots generated from fictional fixtures.');
})().catch(e=>{console.error(e);process.exit(1)});
