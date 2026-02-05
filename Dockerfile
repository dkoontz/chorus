# syntax=docker/dockerfile:1

# =============================================================================
# Build Stage
# =============================================================================
# Build all Gren applications and compile the file-tools binary

FROM --platform=linux/amd64 node:22-bookworm AS builder

# Install Gren compiler
RUN npm install -g gren-lang@0.6.3

# Install Bun for binary compilation
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy source files needed for build
COPY src/ src/

# Build chorus-ui (browser JS)
WORKDIR /app/src/chorus-ui
RUN gren make Main --output=build/app.js

# Build file-tools (compiled binary via Bun)
WORKDIR /app/src/tools
RUN gren make Main --output=build/file-tools-tmp && \
    tail -n +2 build/file-tools-tmp > build/file-tools.js && \
    bun build --compile build/file-tools.js --outfile build/file-tools && \
    rm build/file-tools-tmp build/file-tools.js

# Build chorus (main app - includes integrated agent executor)
WORKDIR /app/src/chorus
RUN gren make Main --output=build/chorus.js

# Copy UI assets to chorus static directory
RUN cp /app/src/chorus-ui/build/app.js static/ && \
    cp /app/src/chorus-ui/static/index.html static/ && \
    cp /app/src/chorus-ui/static/styles.css static/


# =============================================================================
# Runtime Stage
# =============================================================================
# Minimal runtime image with only compiled artifacts

FROM --platform=linux/amd64 node:22-bookworm-slim AS runtime

# Set working directory
WORKDIR /app

# Create data directory (will be overridden by volume mount)
RUN mkdir -p /app/data/registry /app/data/workspaces

# Create .claude directory for auth persistence
RUN mkdir -p /root/.claude

# Install Claude Code CLI for agent-executor
RUN npm install -g @anthropic-ai/claude-code

# Copy compiled artifacts from build stage
COPY --from=builder /app/src/chorus/build/chorus.js /app/build/chorus.js
COPY --from=builder /app/src/chorus/static/ /app/static/
COPY --from=builder /app/src/tools/build/file-tools /app/build/file-tools

# Set environment variables
ENV NODE_ENV=production
ENV CHORUS_HOST=0.0.0.0
ENV CHORUS_PORT=8080
ENV CHORUS_DATA_DIR=/app/data
ENV CHORUS_STATIC_DIR=/app/static
ENV CHORUS_LOG_LEVEL=info

# Expose port
EXPOSE 8080

# Run the server
CMD ["node", "build/chorus.js"]
