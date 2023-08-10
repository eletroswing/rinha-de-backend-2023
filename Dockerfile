FROM node:18

WORKDIR /src

COPY package.json ./

RUN npm install 

COPY . .

EXPOSE 80

CMD ["npm", "run", "prod"]
