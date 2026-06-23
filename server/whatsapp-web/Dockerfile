# WhatsApp Web companion service — needs a real Chromium for whatsapp-web.js.
FROM node:20-slim

# Chromium + the libs Puppeteer needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 \
    libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Use the system Chromium instead of downloading one.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

# Persist the WhatsApp session here — mount a volume / persistent disk at /app/.wwebjs_auth.
ENV SESSION_PATH=/app/.wwebjs_auth
VOLUME ["/app/.wwebjs_auth"]

EXPOSE 8787
CMD ["node", "index.js"]
