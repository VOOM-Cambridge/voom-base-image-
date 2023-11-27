FROM digitalshoestring/shoestring-django-rest:v0.0.1
COPY ./requirements.txt /requirements.txt
RUN pip install -r /requirements.txt && rm -f /requirements.txt
WORKDIR /app
ADD ./code /app/
