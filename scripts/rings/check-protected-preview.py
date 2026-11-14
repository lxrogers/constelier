"""Test this project's Preview with existing auth and a short-lived OIDC token.

No protection/settings changes, persisted tokens, secret output, or weakened TLS.
RING_URL must point to the exact intended preview /prototypes/rings route.
"""
import json
import os
import subprocess
import urllib.request
from urllib.parse import urlparse

target = os.environ['RING_URL']
parsed = urlparse(target)
if parsed.scheme != 'https' or not parsed.hostname.endswith('.vercel.app') or parsed.path != '/prototypes/rings':
    raise SystemExit('RING_URL must identify a Vercel preview ring route.')

# Same endpoint used by the installed official @vercel/oidc refreshToken helper.
# Vercel CLI's token preflight rejects the environment proxy placeholder; the
# configured API credential binding supports this standard HTTPS request.
url = ('https://api.vercel.com/v1/projects/prj_e3FiZ4CCDnnoisZKsHUBFnbCF80R/token'
       '?source=vercel-oidc-refresh&teamId=team_UToweekwD5EbaXmKZnUJaf9i')
request = urllib.request.Request(url, method='POST', headers={
    'Authorization': 'Bearer ' + os.environ['VERCEL_TOKEN'],
})
try:
    with urllib.request.urlopen(request, timeout=20) as response:
        token = json.load(response)['token']
except Exception:
    raise SystemExit('Could not obtain the project development token; no browser test ran.')

environment = os.environ.copy()
environment['VERCEL_OIDC_TOKEN'] = token
environment['RING_PROXY'] = os.environ.get('HTTPS_PROXY', '')
environment['RING_TRUSTED_FETCH'] = '1'
check = os.environ.get('RING_CHECK', 'browser')
if check not in ('browser', 'cadence'):
    raise SystemExit('RING_CHECK must be browser or cadence.')
raise SystemExit(subprocess.call(['node', f'scripts/rings/check-{check}.cjs'], env=environment))
