#!/usr/bin/env bash
# Stable bootstrap for the CI deploy. Installed OUTSIDE the app checkout, at
# /usr/local/sbin/showhands-deploy, and named by the forced command in
# /root/.ssh/authorized_keys.
#
# Why this exists: deploy.sh lives inside the tree it syncs, so a bug in its own
# sync step cannot be fixed by deploying — the fix can only reach the droplet
# through the sync that is broken. A sibling app on this droplet hit exactly
# that: `checkout -B` aborted on a dirty tracked file, and the commit that
# reordered the reset ahead of it could never land. Seven deploys failed over
# four weeks while the site served stale code behind a green 200.
#
# This wrapper guarantees the checkout, and so deploy.sh itself, is current
# before handing off. Keep it small, and update it only by hand: every line here
# can be fixed only over SSH. All real deploy logic belongs in deploy.sh, which
# is free to change with the app.
set -euo pipefail

# deploy.sh keeps its own copies of these; this file runs before the sync, so it
# cannot source them from the checkout. Change one, change both.
APP_DIR="/opt/showhands/app"
APP_USER="showhands"
BRANCH="main"

if [[ $EUID -ne 0 ]]; then
	echo "showhands-deploy must run as root (the CI forced command; it drops to '$APP_USER')." >&2
	exit 1
fi

run_as() { sudo -u "$APP_USER" -H "$@"; }

echo "==> bootstrap: sync $APP_DIR to origin/$BRANCH"
run_as git -C "$APP_DIR" fetch --prune origin
# Tracked files only. Deliberately no `git clean`: the SQLite database and .env
# live in the checkout and are gitignored.
run_as git -C "$APP_DIR" reset --hard "origin/$BRANCH"

# Drop privileges here. deploy.sh is checked out by, and writable to, the app
# user; running it as root would hand root to anyone who gets code execution as
# that user. The one root step it needs (systemctl restart) is granted through
# deploy/sudoers.
exec sudo -u "$APP_USER" -H "$APP_DIR/deploy/deploy.sh"
