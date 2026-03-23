FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY DataTrans/requirements.txt /app/DataTrans/requirements.txt
RUN pip install --no-cache-dir -r /app/DataTrans/requirements.txt

COPY . /app

WORKDIR /app/DataTrans/src

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]