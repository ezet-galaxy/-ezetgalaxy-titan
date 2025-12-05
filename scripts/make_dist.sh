#!/usr/bin/env bash
set -e
# Create dist folder and copy release binary
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SERVER_DIR="$ROOT/server"
DIST_DIR="$ROOT/dist"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"


# copy binary
if [ -f "$SERVER_DIR/target/release/titan-server" ]; then
cp "$SERVER_DIR/target/release/titan-server" "$DIST_DIR/"
else
# on mac/linux after build the binary name may differ by package name
BIN=$(ls "$SERVER_DIR/target/release" | grep titan-server || true)
if [ -n "$BIN" ]; then
cp "$SERVER_DIR/target/release/$BIN" "$DIST_DIR/titan-server"
fi
fi


# Generate routes.json from project root by inspecting templates (we assume user ran JS bundler to emit routes.build.json)
if [ -f "$ROOT/routes.build.json" ]; then
cp "$ROOT/routes.build.json" "$DIST_DIR/routes.json"
else
# try default template
echo "{}" > "$DIST_DIR/routes.json"
fi


# copy handlers if any
mkdir -p "$DIST_DIR/handlers"
if [ -d "$ROOT/handlers" ]; then
cp -r "$ROOT/handlers"/* "$DIST_DIR/handlers/" || true
fi


echo "Created dist/ with titan-server and routes.json"