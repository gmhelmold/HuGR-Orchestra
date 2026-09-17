"""Independent assertions over captured provider requests, not copied product logic."""
import json, sys
from pathlib import Path
p=Path(sys.argv[1]); rows=json.loads(p.read_text()); by={r['mode']:r for r in rows}
assert len(rows)==12 and len(by)==12, 'incomplete observation set'
claim='AUDIT_OWN_VALUE_ONE: src/a.ts exports value = 1.'
checks=[]
for name in ('fresh-tool','fresh-command','http-fresh-tool'):
 r=by[name];text=json.dumps(r['messages']);checks.append({'case':name,'kind':'control','pass':r['verified']['status']=='READY' and claim in text and 'You are Maestro' in text})
for name,marker in [('missing-tool',None),('ordinary-skill','ORDINARY_CONTEXT_CONTROL')]:
 text=json.dumps(by[name]['messages']); checks.append({'case':name,'kind':'control','pass':claim not in text and (marker is None or marker in text)})
for name in ('dirty-cold-tool','dirty-warm-tool','committed-cold-tool','deleted-cold-tool','dirty-command','http-dirty-tool'):
 r=by[name];assert r['verified']['status']=='HOLD',f'{name}: stale setup not established'
 text=json.dumps(r['messages']);checks.append({'case':name,'kind':'desired-currentness','pass':claim not in text})
history=by['history-after-dirty']
report={'input':p.name,'checks':checks,'passingControls':sum(x['pass'] for x in checks if x['kind']=='control'),'failingDesired':sum(not x['pass'] for x in checks if x['kind']=='desired-currentness'),'historyObservation':{'requests':history['requestCount'],'oldClaimRetained':claim in json.dumps(history['messages']),'classification':'retained history, not a second load; not scored as an independent product failure'}}
print(json.dumps(report,indent=2));sys.exit(0 if all(x['pass'] for x in checks) else 1)
