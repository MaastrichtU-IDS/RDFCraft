#!/usr/bin/env bash

set -euo pipefail

APP_BUNDLE_LOCATION="./dist/RDFCraft.app"

# Following directories in the list are data files and should be moved to /Contents/Resources
# and a symlink should be created in /Contents/MacOS
# Create /Contents/Resources if it doesn't exist
mkdir -p "$APP_BUNDLE_LOCATION/Contents/Resources"

DATA_DIRS=(
    "bin" # RMLMapper.jar
    "certifi"
    "public" # Frontend
    "pytz"
    "tzdata"
    "webview"
)


# Move and create symlinks for data directories
for dir in "${DATA_DIRS[@]}"; do
    echo "Processing directory: $dir"
    mv "$APP_BUNDLE_LOCATION/Contents/MacOS/$dir" "$APP_BUNDLE_LOCATION/Contents/Resources/"
    cd "$APP_BUNDLE_LOCATION/Contents/MacOS/" # needs to be a relative symlink
    ln -s "../Resources/$dir" "."
    cd -
done

# Exception for pandas/io
mkdir -p "$APP_BUNDLE_LOCATION/Contents/Resources/pandas/"
mv "$APP_BUNDLE_LOCATION/Contents/MacOS/pandas/io" "$APP_BUNDLE_LOCATION/Contents/Resources/pandas/io"
cd "$APP_BUNDLE_LOCATION/Contents/MacOS/pandas"
ln -s "../../Resources/pandas/io" "."
cd -