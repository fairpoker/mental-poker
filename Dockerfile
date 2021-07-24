FROM node:12

WORKDIR /app

ADD . /app

RUN npm install

EXPOSE 3000

ENV NAME dev

CMD ["npm", "run", "start"]
