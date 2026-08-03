# Pen Neer — single image: build the SPA, then serve it from FastAPI alongside /ws.

# --- stage 1: build the frontend ---
FROM node:22-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- stage 2: backend runtime ---
FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PENNEER_STATIC=/app/static

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
# The built SPA is served as static files by FastAPI (see app/main.py).
COPY --from=frontend /fe/dist ./static
# De kaart-art van Ontdekken. NA de dist-kopie, anders overschrijft die hem
# weer. Hij hoort niet in frontend/public: dat zou hem door de Vite-build
# slepen bij elke wijziging, terwijl het data is die met de catalogus meegroeit
# en niet met de app.
COPY backend/static/cards ./static/cards
# En de scripts plus de CSV's, zodat het seeden op de server kan draaien.
COPY backend/scripts ./scripts
COPY backend/data ./data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
