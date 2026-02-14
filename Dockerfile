FROM python:3.9-slim

WORKDIR /app

# System deps for Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium
RUN playwright install chromium

# Copy source code
COPY backend/ backend/
COPY tools/ tools/
COPY scripts/ scripts/
COPY workflows/ workflows/

# Create tmp dir for local renders (ephemeral, used as scratch space)
RUN mkdir -p .tmp/renders

ENV ENVIRONMENT=production
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
