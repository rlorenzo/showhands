#!/usr/bin/env bash
# Deploy origin/main to the droplet (small-apps). Invoked by CI as root via a
# forced command in /root/.ssh/authorized_keys, so the CI key can ONLY run this
# script and never get a shell. Also runnable by hand: sudo deploy/deploy.sh
set -euo pipefail

APP_DIR="/opt/showhands/app"
APP_USER="showhands"
BRANCH="main"

trap 'echo "!! deploy.sh FAILED (line $LINENO): $BASH_COMMAND" >&2' ERR

if [[ $EUID -ne 0 ]]; then
	echo "deploy.sh must run as root (it su's to '$APP_USER' and restarts the service)." >&2
	exit 1
fi

run_as() { sudo -u "$APP_USER" -H "$@"; }

echo "==> sync $APP_DIR to origin/$BRANCH"
BEFORE=$(run_as git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo none)
run_as git -C "$APP_DIR" fetch --prune origin
run_as git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
run_as git -C "$APP_DIR" reset --hard "origin/$BRANCH"
AFTER=$(run_as git -C "$APP_DIR" rev-parse HEAD)
echo "    $BEFORE -> $AFTER"

echo "==> npm ci"
run_as npm --prefix "$APP_DIR" ci

echo "==> npm run build"
run_as npm --prefix "$APP_DIR" run build

echo "==> restart showhands-web"
systemctl restart showhands-web.service

echo "==> post-deploy health"
ok=0
for _ in $(seq 1 10); do
	if curl -fsS http://127.0.0.1:3002/healthz >/dev/null 2>&1; then
		ok=1
		break
	fi
	sleep 2
done
[ "$ok" = 1 ] || {
	echo "/healthz unhealthy after restart" >&2
	exit 1
}
echo "==> deploy complete: $(date -u +%FT%TZ) @ $AFTER"
