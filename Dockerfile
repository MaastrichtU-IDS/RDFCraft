FROM node:lts-alpine AS frontend-build

WORKDIR /app

COPY ./app/package.json ./app/package-lock.json \
 ./app/tsconfig.json ./app/tsconfig.app.json ./app/tsconfig.node.json \
  ./app/vite.config.ts ./app/index.html ./

RUN npm install

COPY ./app/src ./src

RUN npm run build

FROM ghcr.io/astral-sh/uv:python3.11-alpine



# Install JRE and curl

RUN apk add --no-cache openjdk11-jre && \
    addgroup -S app && adduser -S app -G app

USER app

ENV DEBUG=1

WORKDIR /app

# Download RMLMapper

ADD https://github.com/RMLio/rmlmapper-java/releases/download/v7.2.0/rmlmapper-7.2.0-r374-all.jar ./bin/mapper.jar

# Copy the backend dependencies

COPY ./pyproject.toml ./uv.lock ./.python-version ./

# Install backend dependencies

RUN uv sync

# Copy Backend source code

COPY main.py bootstrap.py ./
COPY ./server ./server


# Copy the frontend build

COPY --from=frontend-build /app/dist ./public


CMD ["uv", "run", "main.py"]

EXPOSE 8000