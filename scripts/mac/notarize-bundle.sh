#!/usr/bin/env bash

set -euo pipefail

# ========================
# Config
# ========================
SIGN_ID="${SIGN_ID:-}"
TEAM_ID="${TEAM_ID:-}"
APPLE_ID="${APPLE_ID:-}"
APP_PASSWORD="${APP_PASSWORD:-}"

APP_NAME="RDFCraft"
APP_BUNDLE_LOCATION="./dist/RDFCraft.app"

# ========================
# Sign native libraries inside mapper.jar (if present)
# ========================
JAR_PATH="$APP_BUNDLE_LOCATION/Contents/Resources/bin/mapper.jar"
if [[ ! -f "$JAR_PATH" ]]; then
  alt=$(find "$APP_BUNDLE_LOCATION" -name mapper.jar -print -quit || true)
  if [[ -n "${alt:-}" ]]; then
    JAR_PATH="$alt"
  fi
fi

if [[ -f "$JAR_PATH" ]]; then
  echo "[Signing native libraries inside mapper.jar]"
  WORK="$(mktemp -d)"
  mkdir -p "$WORK/jar"
  unzip -q "$JAR_PATH" -d "$WORK/jar"
  # Find and sign .dylib and .jnilib files
  while IFS= read -r -d '' NATIVE; do
    echo "  Signing ${NATIVE#"$WORK/jar/"}"
    codesign --force --sign "$SIGN_ID" --options runtime --timestamp "$NATIVE"
    codesign --verify --verbose=2 "$NATIVE"
  done < <(find "$WORK/jar" -type f \( -name "*.dylib" -o -name "*.jnilib" \) -print0)
  # Rebuild the jar completely and replace original
  NEW_JAR="$WORK/mapper.signed.jar"
  (cd "$WORK/jar" && zip -qry "$NEW_JAR" .)
  mkdir -p "$(dirname "$JAR_PATH")"
  install -m 0644 "$NEW_JAR" "$JAR_PATH"
  rm -rf "$WORK"
fi


while IFS= read -r -d '' f; do
  if file -b "$f" | grep -qi 'Mach-O'; then
    echo "  Signing $(basename "$f")"
    codesign --force --sign "$SIGN_ID" --options runtime --timestamp "$f"
    codesign --verify --verbose=2 "$f"
  fi
done < <(find "$APP_BUNDLE_LOCATION/Contents/MacOS" -type f -print0)

# Explicitly sign the main launcher last among inner binaries
codesign --force --sign "$SIGN_ID" --options runtime --timestamp "$APP_BUNDLE_LOCATION/Contents/MacOS/RDFCraft"

# Finally sign the .app bundle itself (without --deep)
codesign --force --sign "$SIGN_ID" --options runtime --timestamp "$APP_BUNDLE_LOCATION"

echo "Verifying signatures"
codesign --verify --strict --verbose=2 "$APP_BUNDLE_LOCATION"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE_LOCATION" || true
spctl --assess --type execute --verbose=4 "$APP_BUNDLE_LOCATION" || true


echo "Creating zip"
rm -f dist/${APP_NAME}.zip
( cd dist && zip -qry ${APP_NAME}.zip "${APP_NAME}.app" )

echo "Submitting for notarization"
xcrun notarytool submit \
  --wait \
  --apple-id "$APPLE_ID" \
  --password "$APP_PASSWORD" \
  --team-id "$TEAM_ID" \
  "dist/${APP_NAME}.zip"

echo "Stapling"
xcrun stapler staple "$APP_BUNDLE_LOCATION"

echo "All done. Output:"
echo "  App:    $APP_BUNDLE_LOCATION"
echo "  Archive dist/${APP_NAME}.zip"