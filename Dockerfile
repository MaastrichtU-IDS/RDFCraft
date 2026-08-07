# Stage 1: Build Frontend
FROM node:lts-alpine AS frontend-build

# Set working directory
WORKDIR /app

# Copy necessary files for dependency installation
COPY ./app/package.json ./app/package-lock.json \
 ./app/tsconfig.json ./app/tsconfig.app.json ./app/tsconfig.node.json \
  ./app/vite.config.ts ./app/index.html ./

RUN npm install

# Copy source code and build
COPY ./app/src ./src

RUN npm run build

# Stage 2: Backend dependencies -- needs a Rust toolchain to build the
# shacl-rust Python bindings from source (no prebuilt wheel is published
# upstream yet, so `uv sync` compiles it via maturin/pyo3).
FROM ghcr.io/astral-sh/uv:python3.11-alpine AS backend-build

WORKDIR /app

RUN apk add --no-cache rust cargo musl-dev build-base git

COPY ./pyproject.toml ./uv.lock ./.python-version ./
RUN uv sync --no-dev

# Stage 3: Backend and Final Image
FROM ghcr.io/astral-sh/uv:python3.11-alpine

# Set working directory
WORKDIR /app

# Install JDK and other dependencies. libgcc is the runtime counterpart of
# the build-base/gcc used to compile the shacl-rust extension module above --
# without it, importing shacl_rust fails at runtime with a missing
# libgcc_s.so.1.
RUN apk add --no-cache openjdk17-jdk curl libgcc && \
    addgroup -S app && adduser -S app -G app

# Download RMLMapper
ADD https://github.com/RMLio/rmlmapper-java/releases/download/v7.3.3/rmlmapper-7.3.3-r374-all.jar /app/bin/mapper.jar

# Set root for installation and changing permissions
USER root
RUN chmod +x /app/bin/mapper.jar

# Copy the prebuilt virtualenv from the backend-build stage (avoids shipping
# the Rust toolchain in the final image)
COPY --from=backend-build /app/.venv ./.venv
COPY ./pyproject.toml ./uv.lock ./.python-version ./

# Copy Backend source code
COPY main.py bootstrap.py ./
COPY ./server ./server

# Copy the frontend build from the first stage
COPY --from=frontend-build /app/dist ./public

# Switching user
USER app

# Environment variables
ENV DEBUG=1

# Expose port
EXPOSE 8000

# Start the application -- invoke the prebuilt venv's interpreter directly
# rather than `uv run`, which would otherwise try to re-sync against
# pyproject.toml/uv.lock using a Rust toolchain this final image doesn't have.
CMD [".venv/bin/python", "main.py"]