FROM node:24-bookworm-slim AS node
FROM python:3.12-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
COPY requirements-tested.txt .
RUN pip install --no-cache-dir -r requirements.txt -c requirements-tested.txt
RUN useradd -u 10001 -m kerski && mkdir /data && chown kerski /data
COPY kerski ./kerski
USER kerski
CMD ["uvicorn", "kerski.api:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
