# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.19.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js"

# Next.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev --legacy-peer-deps

# Copy application code
COPY . .

# Accept build-time ARG and convert to ENV for Next.js build
# NEXT_PUBLIC_ vars must be available at build time to be embedded in the bundle
ARG NEXT_PUBLIC_MAPBOX_API_KEY
ENV NEXT_PUBLIC_MAPBOX_API_KEY=$NEXT_PUBLIC_MAPBOX_API_KEY

ARG NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
ENV NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=$NEXT_PUBLIC_GOOGLE_PLACES_API_KEY

ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY

ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

ARG NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_REGULAR
ENV NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_REGULAR=$NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_REGULAR

ARG NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_REGULAR
ENV NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_REGULAR=$NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_REGULAR

ARG NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_PROMO
ENV NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_PROMO=$NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_PROMO

ARG NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_PROMO
ENV NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_PROMO=$NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_PROMO

# Set placeholder DATABASE_URL for build phase only
# (Prisma client needs it to initialize, but won't actually connect during build)
# Real DATABASE_URL is injected at runtime via Fly secrets
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev --legacy-peer-deps


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Entrypoint sets up the container.
ENTRYPOINT [ "/app/docker-entrypoint.js" ]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "start" ]
