FROM node:22-alpine AS build

WORKDIR /app/frontend

COPY package.json ./
RUN npm install

COPY . .

# Point the built app at the API. Leave empty for local docker-compose (the
# browser then calls the host's :8000). For a real host pass, for example:
#   --build-arg VITE_API_BASE_URL=https://api.your-domain.com/api/v1
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
