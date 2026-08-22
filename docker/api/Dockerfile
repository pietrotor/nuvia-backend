FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends procps tesseract-ocr tesseract-ocr-spa \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
