#!/usr/bin/env bash
set -euo pipefail

# ========================
# Config
# ========================
SIGN_ID="${SIGN_ID:-}"
PRODUCT_VERSION="${PRODUCT_VERSION:-0.4.0}"
FILE_VERSION="${FILE_VERSION:-0.4.0}"
APP_NAME="RDFCraft"
APP_ID="com.ensaremirerol.rdfcraft"

rm -rf build dist public bin

mkdir -p bin
npm run frontend:prod

curl -fsSL \
  https://github.com/RMLio/rmlmapper-java/releases/download/v7.3.3/rmlmapper-7.3.3-r374-all.jar \
  -o bin/mapper.jar

uv sync

uv run nuitka \
  --standalone \
  --product-version="$PRODUCT_VERSION" \
  --file-version="$FILE_VERSION" \
  --output-dir=dist \
  --include-data-dir=public=public \
  --include-data-dir=bin=bin \
  --macos-sign-identity="${SIGN_ID}" \
  --macos-sign-notarization \
  --macos-create-app-bundle \
  --macos-signed-app-name="$APP_ID" \
  --macos-app-name="$APP_NAME" \
  --macos-prohibit-multiple-instances \
  --macos-app-protected-resource="NSLocalNetworkUsageDescription:This application requires to run a local server to serve the frontend." \
  --product-name="$APP_NAME" \
  --output-filename="$APP_NAME" \
  --assume-yes-for-downloads \
  --deployment \
  main.py

# Rename the app bundle
mv dist/main.app dist/RDFCraft.app