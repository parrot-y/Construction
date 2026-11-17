#!/bin/sh
# Render nginx config with the API upstream, then start nginx.
set -e
export API_UPSTREAM="${API_UPSTREAM:-http://localhost:3001}"
envsubst '${API_UPSTREAM}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
