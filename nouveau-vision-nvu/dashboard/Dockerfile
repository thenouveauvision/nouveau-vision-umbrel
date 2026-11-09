FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN groupadd --gid 1000 nvu-dashboard \
    && useradd \
        --uid 1000 \
        --gid nvu-dashboard \
        --no-create-home \
        --shell /usr/sbin/nologin \
        nvu-dashboard

COPY requirements.txt /app/requirements.txt

RUN pip install \
    --no-cache-dir \
    --requirement /app/requirements.txt

COPY server.py /app/server.py
COPY nvu_rpc.py /app/nvu_rpc.py
COPY asicseer_status.py /app/asicseer_status.py
COPY asicseer_workers.py /app/asicseer_workers.py
COPY blocks_found.py /app/blocks_found.py
COPY static /app/static

RUN chown -R nvu-dashboard:nvu-dashboard /app

USER nvu-dashboard

EXPOSE 8080

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=10s \
    --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http:' + chr(47) + chr(47) + '127.0.0.1:8080/api/health', timeout=3).read()" || exit 1

CMD ["gunicorn", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "2", \
     "--threads", "4", \
     "--timeout", "30", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "server:app"]
