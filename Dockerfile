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

# Stage 2: Backend and Final Image
FROM ghcr.io/astral-sh/uv:python3.11-alpine

# Set working directory
WORKDIR /app

# Install JDK and other dependencies 
RUN apk add --no-cache openjdk17-jdk curl && \
    addgroup -S app && adduser -S app -G app

# Download RMLMapper
ADD https://github.com/RMLio/rmlmapper-java/releases/download/v7.2.0/rmlmapper-7.2.0-r374-all.jar /app/bin/mapper.jar

# Set root for installation and changing permissions
USER root
RUN chmod +x /app/bin/mapper.jar

# Copy the backend dependencies and install
COPY ./pyproject.toml ./uv.lock ./.python-version ./
RUN uv sync

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

# Start the application
CMD ["uv", "run", "main.py"]