# check=skip=SecretsUsedInArgOrEnv
# ^ A VITE_SUPABASE_ANON_KEY NÃO é segredo: é chave pública (anon), embutida no
#   bundle do frontend que todo navegador baixa. A proteção real é o RLS no
#   banco. O linter só reclama por causa do "KEY" no nome.

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Dependências primeiro (aproveita cache de camada)
COPY package.json package-lock.json ./
RUN npm ci

# Código
COPY . .

# O Vite EMBUTE as variáveis VITE_* no bundle em tempo de BUILD.
# O EasyPanel passa as env vars do serviço como --build-arg; estes ARG recebem.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# ---------- runtime ----------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
