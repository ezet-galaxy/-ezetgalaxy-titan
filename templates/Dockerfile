# ================================================================
# STAGE 1 — Build Titan (JS → Rust)
# ================================================================
FROM rust:1.91.1 AS builder

# Install Node for Titan CLI and bundler
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Titan CLI globally
RUN npm install -g @ezetgalaxy/titan

WORKDIR /app

# Copy project files into container
COPY . .

# Install JS dependencies (for bundler & DSL)
RUN npm install

# Build Titan metadata (routes.json + actions/*.jsbundle)
RUN tit build

# Build the Rust backend (release mode)
RUN cd server && cargo build --release



# ================================================================
# STAGE 2 — Runtime Image 
# ================================================================
FROM debian:stable-slim

WORKDIR /app

# -------------------------------------------------------------
# Copy the Rust binary
# -------------------------------------------------------------
COPY --from=builder /app/server/target/release/server ./titan-server

# -------------------------------------------------------------
# Copy Titan routing metadata (REQUIRED)
# -------------------------------------------------------------
COPY --from=builder /app/server/routes.json ./routes.json
COPY --from=builder /app/server/action_map.json ./action_map.json

# -------------------------------------------------------------
# Copy Titan JS bundles directory (REQUIRED)
# -------------------------------------------------------------
RUN mkdir -p /app/actions
COPY --from=builder /app/server/actions /app/actions


# -------------------------------------------------------------
# Runtime configuration
# -------------------------------------------------------------
EXPOSE 3000

CMD ["./titan-server"]
