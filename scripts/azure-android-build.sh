#!/usr/bin/env bash
#
# Build a debug Android APK on a throwaway Azure VM, fetch it to ./dist, then
# delete the VM. For ad-hoc Android test builds without a local Android
# toolchain. (Store/iOS builds go through Codemagic — see codemagic.yaml.)
#
# Requires: az CLI (logged in), ssh/scp, tar. Run from the repo root:
#   bash scripts/azure-android-build.sh            # build + teardown
#   bash scripts/azure-android-build.sh --keep     # leave the VM running
#
# Defaults target the "TMC Azure Sandbox and Testing" subscription in ukwest
# (uksouth has VM SKU capacity restrictions for that sub). Override via env:
#   SUB=<id> REGION=<r> SIZE=<sku> bash scripts/azure-android-build.sh
set -euo pipefail

SUB="${SUB:-59b56eea-74c6-43fc-95cb-aa1afc0e2065}"   # TMC Azure Sandbox and Testing
REGION="${REGION:-ukwest}"
SIZE="${SIZE:-Standard_D2as_v5}"
RG="${RG:-TMC-SKINCHECK-BUILDVM}"
VM="${VM:-tmc-androidbuild}"
KEEP=0; [ "${1:-}" = "--keep" ] && KEEP=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
KEY="$WORK/buildvm_key"
SSHOPT="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -o ServerAliveInterval=15"

cleanup_vm() {
  if [ "$KEEP" = "0" ]; then
    echo ">> deleting resource group $RG"
    az group delete -n "$RG" --subscription "$SUB" --yes --no-wait || true
  else
    echo ">> --keep set; leaving VM up. Delete later with:"
    echo "   az group delete -n $RG --subscription $SUB --yes"
  fi
}
trap cleanup_vm EXIT

echo ">> generating ephemeral SSH key"
ssh-keygen -t rsa -b 4096 -m PEM -f "$KEY" -N "" -C tmc-buildvm >/dev/null

echo ">> creating RG + VM ($SIZE in $REGION)"
az group create -n "$RG" -l "$REGION" --subscription "$SUB" -o none
IP=$(az vm create -g "$RG" -n "$VM" --subscription "$SUB" \
  --image Ubuntu2204 --size "$SIZE" \
  --admin-username azureuser --ssh-key-values "$KEY.pub" \
  --public-ip-sku Standard --os-disk-size-gb 64 --nsg-rule SSH \
  --query publicIpAddress -o tsv)
echo ">> VM IP: $IP"

echo ">> waiting for SSH"
for i in $(seq 1 25); do
  ssh -i "$KEY" $SSHOPT azureuser@"$IP" true 2>/dev/null && break
  sleep 6
done

echo ">> packaging repo"
tar czf "$WORK/repo.tgz" -C "$REPO" \
  --exclude=node_modules --exclude=www --exclude=.git \
  --exclude=android/app/build --exclude=android/.gradle --exclude=android/build \
  --exclude=ios/App/Pods --exclude=ios/App/build --exclude=dist .

# Remote build script
cat > "$WORK/remote-build.sh" <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y -q
sudo apt-get install -y -q openjdk-17-jdk unzip wget
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
sudo apt-get install -y -q nodejs
rm -rf "$HOME/app" && mkdir -p "$HOME/app" && tar xzf "$HOME/repo.tgz" -C "$HOME/app"
export ANDROID_HOME="$HOME/android-sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
cd /tmp
wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdtools.zip
unzip -q -o cmdtools.zip -d "$ANDROID_HOME/cmdline-tools"
rm -rf "$ANDROID_HOME/cmdline-tools/latest"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" >/dev/null
cd "$HOME/app"
npm install --no-audit --no-fund
npm run sync:web
npx cap sync android
cd "$HOME/app/android"
echo "sdk.dir=$ANDROID_HOME" > local.properties
export JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(which javac)")")")"
./gradlew --no-daemon assembleDebug
echo BUILD_DONE_OK
REMOTE

echo ">> uploading + building (this takes a few minutes)"
scp -i "$KEY" $SSHOPT "$WORK/repo.tgz" "$WORK/remote-build.sh" azureuser@"$IP":~/
ssh -i "$KEY" $SSHOPT azureuser@"$IP" "bash ~/remote-build.sh"

echo ">> fetching APK"
mkdir -p "$REPO/dist"
OUT="$REPO/dist/tmc-skincheck-debug.apk"
scp -i "$KEY" $SSHOPT \
  azureuser@"$IP":~/app/android/app/build/outputs/apk/debug/app-debug.apk "$OUT"
echo ">> done: $OUT"
ls -lh "$OUT"
