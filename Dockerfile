FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
# Garantiza que nginx pueda leer todo, sin importar los permisos con que se copiaron los archivos (p. ej. desde Windows).
RUN chmod -R a+rX /usr/share/nginx/html
EXPOSE 80
