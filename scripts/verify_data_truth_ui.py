import json,re,time,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
project=Path(__file__).resolve().parents[1]
root=project/'public'
main=(root/'main.js').read_text()
runtime=(root/'wcl-runtime.js').read_text().replace('location.origin','"https://test.local"')
css=(root/'main.css').read_text()+'\n'+(root/'raidops-v34.css').read_text()
# Build realistic fixture
pulls=[]
for i in range(1,15):
    stage=3 if i in [1,4,7,9,10,12,14] else 2 if i in [6,8] else 1
    pulls.append({'fightId':i,'pullNumber':i,'fightPercentage':[44.4,100,100,47.19,100,99.99,46.33,99.97,46.88,46.87,100,66.46,100,47.99][i-1], 'bossPercentage':[76.04,25.21,47.09,85.05,27.61,99.99,83.21,99.97,78.96,63.31,1.08,85.16,97.06,70.94][i-1], 'durationMs':150000+i*2500,'stageCount':stage,'stages':[{'absoluteStageIndex':j,'semanticPhaseId':1 if j!=2 else 2,'startTime':0+(j-1)*60000,'endTime':j*60000} for j in range(1,stage+1)],'raidDps':1500000+i*12000,'raidHps':700000+i*9000,'firstDeathMs':70000+i*5000,'rawDeaths':20,'meaningfulDeaths':max(1,8-i//3),'rosterFingerprint':'same','rosterSize':20})
meaningful_pulls=[x for x in pulls if x['pullNumber']!=13]
latest=meaningful_pulls[-1];prev=meaningful_pulls[-2]
progress_sig={'key':'progress','label':'Fight progress','status':'improved','current':47.99,'baseline':66.46,'delta':-18.47,'unit':'pp','priority':100,'confidence':'high'}
first_sig={'key':'firstDeath','label':'First death','status':'improved','current':140000,'baseline':130000,'delta':10000,'unit':'ms','priority':85,'confidence':'high'}
death_sig={'key':'meaningfulDeaths','label':'Meaningful deaths','status':'regressed','current':4,'baseline':4,'delta':0,'unit':'deaths','priority':80,'confidence':'high'}
pi={'pulls':meaningful_pulls,'excludedPulls':[{'fightId':13,'pullNumber':13,'durationMs':28257,'bossPercentage':97.06,'reason':'early-reset-no-progress'}],'rawClosedPullCount':14,'analysisPullCount':13,'analysisPopulation':{'rawPulls':14,'eligiblePulls':13,'excludedPulls':[{'fightId':13,'pullNumber':13,'classification':'called-wipe','reason':'early-reset-no-progress'}],'eligibleFightIds':[x['fightId'] for x in meaningful_pulls]},'latest':latest,'previous':prev,'best':pulls[0],'currentVsPrevious':{'currentPull':14,'baselinePull':12,'sameStage':True,'rosterChanged':False,'signals':[progress_sig,first_sig,death_sig],'improvements':[progress_sig,first_sig],'regressions':[],'observations':[],'skippedRawPulls':1},'baselines':{'last5':{'sampleSize':5,'sameStageSampleSize':2,'fightPercentage':66.46,'stageCount':2,'firstDeathMs':125000,'meaningfulDeaths':5,'raidDps':1600000,'raidHps':800000},'best':pulls[0]},'status':'ready'}
classes=[('Qea','Druid','Guardian','TANK'),('Mechavalec','Warrior','Protection','TANK'),('Nidris','Evoker','Preservation','HEAL'),('Colakao','Monk','Mistweaver','HEAL'),('Teqi','Shaman','Restoration','HEAL'),('Txerokee','Shaman','Restoration','HEAL'),('Rivax','Rogue','Subtlety','DPS'),('Ayriane','DemonHunter','Havoc','DPS'),('Öki','Mage','Frost','DPS'),('Pitet','Shaman','Enhancement','DPS'),('Smöll','Warlock','Demonology','DPS'),('Inds','Priest','Shadow','DPS'),('Dkaigo','DeathKnight','Unholy','DPS'),('Shodåw','Hunter','BeastMastery','DPS'),('Ssquall','Paladin','Retribution','DPS'),('Flysmi','Evoker','Augmentation','DPS'),('Valyr','Warrior','Fury','DPS'),('Linkedara','Priest','Shadow','DPS'),('Helssipanki','Paladin','Retribution','DPS'),('Lorsirïus','DeathKnight','Unholy','DPS')]
players=[]
for idx,(name,cl,spec,role) in enumerate(classes,1):
    players.append({'actorId':idx,'name':name,'className':cl,'spec':spec,'role':role,'itemLevel':288+idx%5,'bestPull':{'damage':20000000,'dps':42000 if role=='TANK' else 140000 if role=='DPS' else 10000,'healing':30000000,'hps':145000 if role=='HEAL' else 10000,'damageTaken':8000000,'casts':1000},'encounter':{'pulls':13,'deaths':10,'meaningfulDeaths':4,'firstDeaths':idx%3,'interrupts':idx%5,'dispels':0},'character':{'gearCount':3,'powerGearCount':3,'recordedItemLevelMean':290,'gearAverageItemLevel':None,'gear':[{'id':250024,'slot':'Head','slotId':1,'itemLevel':289,'wowhead':{'url':'https://www.wowhead.com/item=250024','dataWowhead':'item=250024&ilvl=289'}},{'id':251096,'slot':'Neck','slotId':2,'itemLevel':289,'wowhead':{'url':'https://www.wowhead.com/item=251096','dataWowhead':'item=251096&ilvl=289'}},{'id':244569,'slot':'Feet','slotId':8,'itemLevel':285,'wowhead':{'url':'https://www.wowhead.com/item=244569','dataWowhead':'item=244569&ilvl=285'}}],'talentCount':3,'talentPoints':4,'buildFingerprint':'build-a1b2c3d4','talentImportCode':'BTESTLOADOUTCODE123','talentWowheadUrl':'https://www.wowhead.com/talent-calc/blizzard/BTESTLOADOUTCODE123','talents':[{'nodeId':82126,'entryId':9001,'spellId':None,'rank':1,'name':None,'wowhead':{'url':'https://www.wowhead.com/search?q=talent%20node%2082126'}},{'nodeId':82127,'spellId':12345,'rank':1,'name':'Known Talent','wowhead':{'url':'https://www.wowhead.com/spell=12345','dataWowhead':'spell=12345'}},{'nodeId':82128,'entryId':9003,'rank':2,'name':None,'wowhead':{'url':'https://www.wowhead.com/search?q=talent%20node%2082128'}}]},'reliability':{'value':None,'status':'pending','confidence':'unknown'}})
payload={'ok':True,'generatedAt':1786692704103,'guild':{'name':'Avoid','server':{'name':'Sanguino','region':{'compactName':'EU'}}},'report':{'code':'28d9xF7GchL6ZPYt','zone':{'name':'VS / DR / MQD'}},'encounter':{'id':3182,'name':"Belo'ren, Child of Al'ar",'difficultyName':'Mythic','completedPulls':13,'pulls':13,'rawPulls':14,'rawCompletedPulls':14,'kills':0,'maxObservedPhase':3,'maxObservedStage':3},'overview':{'bestPull':{'fightId':1,'pullNumber':1,'fightPercentage':44.4,'bossPercentage':76.04,'durationMs':189017,'raidDps':1683068,'raidHps':810835,'phaseTransitions':[{'id':1,'startTime':0},{'id':2,'startTime':106000},{'id':1,'startTime':146000}],'firstDeath':{'fightRelativeMs':157110}},'comparePull':{'fightId':7,'pullNumber':7,'fightPercentage':46.33,'bossPercentage':83.21,'durationMs':185318,'raidDps':1640196,'raidHps':776594,'phaseTransitions':[],'firstDeath':{'fightRelativeMs':139130}},'phaseConversion':{'denominator':13,'counts':{'1':13,'2':9,'3':7},'percentages':{'1':100,'2':64,'3':50}},'earlyDeaths':10,'earlyDeathDefinition':'First real death before stage 3','p3SurvivalMedianMs':45000,'medianFightPercentage':83.215,'breakthrough':None,'raidDps':1683068,'raidHps':810835,'executeDps':1500000,'executeHps':900000,'overhealPct':37.4},'progression':[dict(x,firstDeath={'fightRelativeMs':x['firstDeathMs']},maxPhase=x['stageCount'],stageCount=x['stageCount']) for x in meaningful_pulls],'roster':[{'actorId':p['actorId'],'name':p['name'],'className':p['className'],'spec':p['spec'],'role':p['role'],'itemLevel':p['itemLevel']} for p in players]}
# Graph fixture
series={'data':{'series':[{'name':'Total','id':'Total','data':[0,100,300,450,390,700,800,650,900,1100,980,1200]}]}}
tele={'ok':True,'generatedAt':1786692866371,'engineVersion':'3.4.2','reportCode':'28d9xF7GchL6ZPYt','encounter':{'id':3182,'name':"Belo'ren, Child of Al'ar",'pulls':13,'rawPulls':14,'completedPulls':13,'rawCompletedPulls':14,'maxObservedPhase':3,'maxObservedStage':3},'bestPull':payload['overview']['bestPull'],'comparePull':payload['overview']['comparePull'],'throughput':{'best':{'dps':1683068,'hps':810835},'compare':{'dps':1640196,'hps':776594},'phases':{'p1':{'dps':1686000,'hps':586000},'p2':{'dps':1678000,'hps':1097000},'p3':{'dps':1540000,'hps':920000}}},'pullIntelligence':pi,'players':players,'playerProfiles':{'coverage':{'roster':20,'withGear':20,'withTalents':20}},'deaths':{'rawCount':289,'meaningfulCount':70,'firstDeathCount':14,'earlyDeaths':10,'targetEarlyStage':3,'wipeCutoff':5},'mechanics':{'observedAbilities':[{'id':1241932,'name':'Voidlight Convergence','totalDamageTaken':313018304,'firstCastMs':38000},{'id':1264650,'name':'Burning Heart','totalDamageTaken':296984267,'firstCastMs':51000},{'id':1242803,'name':'Light Flames','totalDamageTaken':191044701,'firstCastMs':72000}], 'interruptsDetected':118,'dispelsDetected':0,'deathsDetected':289,'meaningfulDeathsDetected':70,'firstDeathsDetected':14,'debuffRows':31,'castRows':21},'consumables':{'detectedUsesByPlayerName':{'qea':{'healthstone':1,'potion':0}}},'bestPullEvents':{'deathCount':20},'graphs':{'damage':series,'healing':series},'dataTruth':{'policy':'real-derived-or-explicit-pending'}}
history={'ok':True,'recentNights':[{'sessionId':'s1','startTime':1780948981381,'pulls':9,'kills':0,'bestFightPercentage':84.91,'medianFightPercentage':100,'sourceReports':2},{'sessionId':'s2','startTime':1782072312560,'pulls':28,'kills':0,'bestFightPercentage':48.54,'medianFightPercentage':100,'sourceReports':1},{'sessionId':'s3','startTime':1782154101761,'pulls':13,'kills':0,'bestFightPercentage':44.4,'medianFightPercentage':83.215,'sourceReports':1}],'currentNight':{'sessionId':'s3'},'delta':{'medianPctPoints':16.785,'bestPctPoints':4.14,'pullDelta':-14}}
status={'ok':True,'generatedAt':1786693000000,'report':{'code':'28d9xF7GchL6ZPYt'},'encounter':{'totalPulls':13,'rawPulls':14,'latestFight':{'inProgress':False}}}
intel={'ok':True,'generatedAt':1786693010000,'engineVersion':'3.4.2','status':'ready','encounter':{'id':3182,'name':"Belo'ren, Child of Al'ar",'pulls':13,'rawPulls':14,'excludedPulls':[{'fightId':13,'reason':'early-reset-no-progress'}]},'analysisPopulation':{'rawPulls':14,'eligiblePulls':13,'excludedPulls':[{'fightId':13,'pullNumber':13,'classification':'called-wipe','reason':'early-reset-no-progress'}]},'rulePack':{'slug':'beloren-child-of-alar','version':'2026.08.14-3','mechanics':17},'mechanics':{'mechanics':[{'key':'incubation-light','name':'Light Flames','category':'match','severity':5,'scoreable':True,'expectedAction':'Move into the Light area while assigned Light.','opportunities':18,'failedOccurrences':7,'failures':7,'playerExposures':7,'denominatorStatus':'normalized','executionSuccessPct':61.1,'linkedDeaths':3,'firstDeaths':3,'confidence':'high'},{'key':'radiant-echoes','name':'Radiant Echoes','category':'orb-management','severity':5,'scoreable':True,'expectedAction':'Clear matching-color orbs.','opportunities':14,'failedOccurrences':4,'failures':4,'playerExposures':4,'denominatorStatus':'normalized','executionSuccessPct':71.4,'linkedDeaths':1,'firstDeaths':1,'confidence':'high'},{'key':'void-eruption','name':'Void Eruption','category':'interrupt','severity':5,'scoreable':True,'expectedAction':'A Void-assigned player interrupts the cast.','opportunities':12,'failedOccurrences':2,'failures':2,'playerExposures':0,'denominatorStatus':'normalized','executionSuccessPct':83.3,'linkedDeaths':0,'firstDeaths':0,'confidence':'confirmed'}],'failures':[{'mechanicKey':'incubation-light','mechanicName':'Light Flames','fightId':14,'actorId':1,'severity':5,'confidence':'high','reason':'VOID player received LIGHT mechanic','fightRelativeMs':120000},{'mechanicKey':'incubation-light','mechanicName':'Light Flames','fightId':14,'actorId':1,'severity':5,'confidence':'high','reason':'VOID player received LIGHT mechanic','fightRelativeMs':121000},{'mechanicKey':'radiant-echoes','mechanicName':'Radiant Echoes','fightId':14,'actorId':2,'severity':5,'confidence':'high','reason':'Failure-proxy damage event observed','fightRelativeMs':130000}],'summary':{'opportunities':44,'failedOccurrences':13,'failures':13,'playerExposures':11,'pendingDenominators':[],'mechanicalAccuracy':78.4,'linkedDeaths':4}},'deathChains':{'windowMs':10000,'chains':[{'fightId':14,'actorId':1,'player':'Qea','fightRelativeMs':140000,'killingBlow':'Voidlight Convergence','confidence':'high','probableCause':{'mechanicKey':'incubation-light','mechanicName':'Light Flames','occurredMsBeforeDeath':4000},'evidence':[{'mechanicKey':'incubation-light','mechanicName':'Light Flames','deltaMs':4000,'confidence':'high','reason':'wrong color'}]}],'linkedByMechanic':{'incubation-light':3},'classified':4,'total':10},'blocker':{'status':'derived','confidence':'high','blocker':{'key':'incubation-light','name':'Light Flames','severity':5,'failedOccurrences':7,'failures':7,'opportunities':18,'failureRate':0.3889,'recentFailures':4,'linkedDeaths':3,'recurrence':4},'ranking':[{'key':'incubation-light','name':'Light Flames','recentFailures':4,'linkedDeaths':3},{'key':'radiant-echoes','name':'Radiant Echoes','recentFailures':2,'linkedDeaths':1}]},'playerMatrix':[{'actorId':1,'name':'Qea','failures':2,'recentFailures':2,'linkedDeaths':1,'mechanics':{'incubation-light':2}},{'actorId':2,'name':'Mechavalec','failures':1,'recentFailures':1,'linkedDeaths':0,'mechanics':{'radiant-echoes':1}}]}}
# Static fake-surface scanner before browser runtime.
patterns={
 'literal percentages':r'\b(?:68|44|82|54|46|47|59|31|61)\s?%',
 'fake fixed counts':r'\b(?:184|128|37|25)\b',
 'fake numeric UI strings':r'children:"(?:68|44|82|54|25|184|128|37|18\.7M|3\.2%)"',
 'hardcoded player arrays':r'\[["\'](?:Qea|Mechavalec|Rivax|Ayriane)["\']',
}
results={}
for f in [root/'main.js',root/'wcl-runtime.js']:
    text=f.read_text(); results[f.name]={k:{'hits':len(re.findall(p,text)),'examples':re.findall(p,text)[:4]} for k,p in patterns.items()}
# Inject all mocked endpoints via fetch.
fixtures={'/report':payload,'/telemetry':tele,'/history':history,'/status':status,'/intelligence':intel}
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page()
    page.on('pageerror',lambda e: errors.append('pageerror:'+str(e)))
    page.on('console',lambda msg: errors.append('console:'+msg.text) if msg.type=='error' else None)
    page.route('https://test.local/api/wcl/**',lambda route: route.fulfill(status=200,content_type='application/json',body=json.dumps(next((v for k,v in fixtures.items() if k in route.request.url),{'ok':True}))))
    html=f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body><div id="root"></div><script>{main}</script><script>{runtime}</script></body></html>'
    page.set_content(html,wait_until='load');page.wait_for_timeout(500)
    # smoke navigation and real labels
    body=page.locator('body').inner_text()
    if "Belo'ren" not in body or 'Mythic' not in body or '13 pulls' not in body:
        print('Data truth labels: FAIL');sys.exit(4)
    print('Data truth labels: PASS')
    # fake header labels should be gone
    if 'VS / DR / MQD' in body or '184 GUILDS' in body:
        print('Fake header labels remain: FAIL');sys.exit(4)
    print('Fake header labels: PASS')
    # Progress should be driven by the progress contract and must not expose legacy fake labels.
    page.get_by_text('Progress',exact=True).first.click();page.wait_for_timeout(150)
    progress_text=page.locator('body').inner_text()
    if 'VALID PULLS' not in progress_text or '13 / 14' not in progress_text or 'CALLED WIPES EXCLUDED' not in progress_text:
        print('Progress contract labels: FAIL');sys.exit(4)
    if 'ALL PULLS · 9 sessions' in progress_text or 'SESSION AVG · Last 5' in progress_text:
        print('Progress legacy fake labels remain: FAIL');sys.exit(4)
    print('Progress contract labels: PASS')
    # Player roster + gear/talent facts must render from WCL-backed payload.
    page.get_by_text('Players',exact=True).first.click();page.wait_for_timeout(150)
    player_text=page.locator('body').inner_text()
    if 'Qea' not in player_text or 'GEAR 3/3' not in player_text or 'TALENTS 3' not in player_text:
        print('Player profile truth: FAIL');sys.exit(4)
    if 'RELIABILITY' not in player_text or 'PENDING' not in player_text:
        print('Player reliability pending-state: FAIL');sys.exit(4)
    print('Player profile truth: PASS')
    # Intelligence/mechanics should show derived evidence without fake unsupported values.
    page.get_by_text('Command Center',exact=True).first.click();page.wait_for_timeout(150)
    command_text=page.locator('body').inner_text()
    if 'Light Flames' not in command_text or 'HIGH CONFIDENCE' not in command_text:
        print('Command blocker intelligence: FAIL');sys.exit(5)
    print('Command blocker intelligence: PASS')
    page.get_by_text('Mechanics',exact=True).first.click();page.wait_for_timeout(150)
    mech_text=page.locator('body').inner_text()
    if '13 failed executions' not in mech_text and 'Light Flames' not in mech_text:
        print('Mechanics intelligence: FAIL');sys.exit(5)
    print('Mechanics intelligence: PASS')
    browser.close()
if errors: sys.exit(2)
if any(v['hits'] for v in results.values()): sys.exit(3)