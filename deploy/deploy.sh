#!/usr/bin/env bash
# Deploy origin/main to the droplet (small-apps). Invoked by CI through
# deploy/bootstrap.sh (installed at /usr/local/sbin/showhands-deploy), which the
# forced command in /root/.ssh/authorized_keys names — so the CI key can ONLY
# run the deploy and never get a shell. The wrapper syncs the checkout, then
# drops to the app user before running this file; see bootstrap.sh for why.
#
# Runs entirely as the app user. The only root action is the service restart,
# allowed by the single sudoers rule in deploy/sudoers.
# Also runnable by hand: sudo -u showhands -H deploy/deploy.sh
set -euo pipefail

# deploy/bootstrap.sh keeps its own copies of these — it runs before the sync,
# so it cannot source them from here. Change one, change both.
APP_DIR="/opt/showhands/app"
APP_USER="showhands"
BRANCH="main"
BOOTSTRAP="/usr/local/sbin/showhands-deploy"

trap 'echo "!! deploy.sh FAILED (line $LINENO): $BASH_COMMAND" >&2' ERR

if [[ $(id -un) != "$APP_USER" ]]; then
	echo "deploy.sh must run as '$APP_USER': sudo -u $APP_USER -H $0" >&2
	exit 1
fi

# On the CI path bootstrap.sh has already synced; this repeats it so a hand-run
# `sudo deploy/deploy.sh` still deploys origin/main rather than whatever happens
# to be checked out. Don't "optimize" it away — it is the only sync on that path.
echo "==> sync $APP_DIR to origin/$BRANCH"
BEFORE=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo none)
git -C "$APP_DIR" fetch --prune origin
# Discard local modifications BEFORE checkout. This is a deploy target, not a
# workspace, so tracked-file edits here are never intentional — and `checkout -B`
# aborts on them, which with the reset on the *next* line meant the reset could
# never run. (Tracked files only: no `git clean`, which would eat the database.)
git -C "$APP_DIR" reset --hard "origin/$BRANCH"
git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
AFTER=$(git -C "$APP_DIR" rev-parse HEAD)
echo "    $BEFORE -> $AFTER"

# Report drift in the wrapper, but deliberately do NOT install it from here.
# This script runs *because* the wrapper invoked it, so overwriting the wrapper
# mid-deploy would put an unexercised sync path live the moment the sync step
# succeeded — recreating, one file over, the deadlock the wrapper prevents.
if ! cmp -s "$APP_DIR/deploy/bootstrap.sh" "$BOOTSTRAP" 2>/dev/null; then
	echo "!! $BOOTSTRAP differs from deploy/bootstrap.sh in the repo." >&2
	echo "!! Review the diff, then update it by hand:" >&2
	echo "!!   sudo install -m 755 $APP_DIR/deploy/bootstrap.sh $BOOTSTRAP" >&2
fi

echo "==> npm ci"
npm --prefix "$APP_DIR" ci

echo "==> npm run build"
npm --prefix "$APP_DIR" run build

echo "==> restart showhands-web"
# -n: fail instead of prompting if the sudoers rule (deploy/sudoers) is missing.
sudo -n systemctl restart showhands-web.service

echo "==> post-deploy health"
# Gate on the commit /healthz reports, not merely on a 200: a restart that kept
# the old bundle still passes a bare liveness check, so a failed deploy can sit
# unnoticed behind a green uptime monitor. Parsed with sed rather than jq
# because nothing in deploy/README.md installs jq on the droplet.
served=""
for _ in $(seq 1 10); do
	# `|| served=""` is load-bearing: the app is still restarting on the first
	# attempts, so curl exits non-zero, and under `set -e` an unguarded
	# assignment from a failing command substitution would abort the loop on
	# attempt 1 instead of retrying.
	served=$(curl -fsS http://127.0.0.1:3002/healthz 2>/dev/null |
		sed -n 's/.*"commit":"\([^"]*\)".*/\1/p') || served=""
	[ "$served" = "$AFTER" ] && break
	sleep 2
done
[ "$served" = "$AFTER" ] || {
	echo "/healthz did not report the deployed commit after restart" >&2
	echo "  expected: $AFTER" >&2
	echo "  served:   ${served:-<no response>}" >&2
	exit 1
}
echo "==> deploy complete: $(date -u +%FT%TZ) @ $AFTER"
