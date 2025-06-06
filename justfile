install-dev:
    @echo "Creating virtual environment..."
    uv sync --all-extras --dev

install:
    @echo "Creating virtual environment..."
    uv sync

test: install-dev
    @echo "Running tests..."
    uv run coverage run -m unittest discover -v -s ./test -p "*_test.py"


package-mac: install-dev
    @echo "Packaging for macOS..."
    rm -rf build dist public bin
    @echo "Downloading external binaries..."
    mkdir -p bin
    curl -L https://github.com/RMLio/rmlmapper-java/releases/download/v7.2.0/rmlmapper-7.2.0-r374-all.jar -o bin/mapper.jar
    npm run frontend:prod
    uv sync
    uv run nuitka \
    --standalone \
    --product-version=0.1.0 \
    --file-version=0.1.0 \
    --output-dir=dist \
    --include-data-dir=public=public \
    --include-data-dir=bin=bin \
    --macos-create-app-bundle \
    --macos-app-protected-resource="NSLocalNetworkUsageDescription:This application requires to run a local server to serve the frontend." \
    --product-name=RDFCraft \
    --assume-yes-for-downloads \
    --deployment \
    main.py
    mv dist/main.app dist/RDFCraft.app

package-win: install-dev
    @echo "Packaging for Windows..."
    rm -rf build dist public bin
    @echo "Downloading external binaries..."
    mkdir -p bin
    curl -L https://github.com/RMLio/rmlmapper-java/releases/download/v7.2.0/rmlmapper-7.2.0-r374-all.jar -o bin/mapper.jar
    npm run frontend:prod
    uv sync
    .venv/Scripts/python -m nuitka \
    --standalone \
    --onefile \
    --product-version=0.1.0 \
    --file-version=0.1.0 \
    --output-dir=dist \
    --include-data-dir=public=public \
    --include-data-dir=bin=bin \
    --windows-disable-console \
    --product-name=RDFCraft \
    --assume-yes-for-downloads \
    --deployment \
    main.py
    mv dist/main.exe dist/RDFCraft.exe