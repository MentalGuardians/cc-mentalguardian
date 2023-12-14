# Use the official lightweight Python image.
# https://hub.docker.com/_/python
FROM python:3.9-slim

# Allow statements and log messages to immediately appear in the Knative logs
ENV PYTHONUNBUFFERED True

# Copy local code to the container image.
ENV APP_HOME /app
WORKDIR $APP_HOME
COPY . ./

# Install production dependencies.
RUN pip install -r requirements.txt

# Download NLTK punkt and wordnet resources
RUN python -m nltk.downloader punkt wordnet -d /usr/share/nltk_data

# Run the web service on container startup.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
