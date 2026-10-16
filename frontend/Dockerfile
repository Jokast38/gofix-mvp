FROM node:20-alpine AS build
WORKDIR /srv/frontend
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY . .
# Empty = same-origin: the browser calls /api/... through the Nginx reverse proxy.
ARG REACT_APP_BACKEND_URL=""
# INLINE_RUNTIME_CHUNK=false: no inline <script> in index.html, required by the Content-Security-Policy.
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL GENERATE_SOURCEMAP=false INLINE_RUNTIME_CHUNK=false
RUN yarn build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /srv/frontend/build /usr/share/nginx/html
EXPOSE 80
