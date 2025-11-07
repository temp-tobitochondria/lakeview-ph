# Web service Dockerfile (supports in-process queue worker)
# - Builds Vite assets (Node 20)
# - Serves Laravel via Apache (PHP 8.2)
# - Includes pdo_pgsql and geospatial tools (postgresql-client, postgis/raster2pgsql, gdal)

# ---------- Stage 1: Frontend build ----------
FROM node:20-bullseye-slim AS nodebuild
WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
# Avoid failing dependency postinstall scripts during smoke test
ENV NPM_CONFIG_FUND=false \
   NPM_CONFIG_AUDIT=false \
   NPM_CONFIG_IGNORE_SCRIPTS=true
RUN npm ci || npm i

# Copy source required for Vite build
COPY . .

# Build assets (outputs to public/build via laravel-vite-plugin)
RUN npm run build

# ---------- Stage 2: PHP + Apache ----------
FROM php:8.2-apache-bookworm

# System packages and PHP extensions
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    git \
    unzip \
    libpq-dev \
    postgresql-client \
    postgis \
    gdal-bin \
 && docker-php-ext-install pdo_pgsql pgsql \
 && docker-php-ext-enable opcache \
 && rm -rf /var/lib/apt/lists/*

# PHP Opcache tuning for production
RUN set -eux; \
   printf "opcache.enable=1\n" \
      "opcache.enable_cli=0\n" \
      "opcache.memory_consumption=192\n" \
      "opcache.interned_strings_buffer=16\n" \
      "opcache.max_accelerated_files=20000\n" \
      "opcache.save_comments=1\n" \
      "opcache.validate_timestamps=0\n" \
      > /usr/local/etc/php/conf.d/opcache.ini

# Increase PHP upload/body limits to support large raster uploads (e.g., 100MB+)
RUN set -eux; \
   printf "upload_max_filesize=128M\npost_max_size=128M\nmemory_limit=512M\nmax_file_uploads=50\nmax_input_time=300\n" > /usr/local/etc/php/conf.d/uploads.ini

# Enable Apache modules and set DocumentRoot to public/
RUN a2enmod rewrite headers \
 && sed -ri 's!DocumentRoot /var/www/html!DocumentRoot /var/www/html/public!g' /etc/apache2/sites-available/000-default.conf \
 && sed -ri 's!<Directory /var/www/>!<Directory /var/www/html/public/>!g' /etc/apache2/apache2.conf \
 && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

WORKDIR /var/www/html

# Install Composer (from official image)
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Leverage build cache for composer deps
COPY composer.json composer.lock* ./
# Install PHP deps. If lock is out-of-date (e.g., package added), fall back to update to unblock build.
RUN set -e; \
   composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader --no-scripts \
   || composer update --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader --no-scripts

# Copy application source
COPY . .

# Bring in built frontend assets
COPY --from=nodebuild /app/public/build /var/www/html/public/build
# Copy GeoPackage assets directly from node_modules (postinstall may be skipped)
COPY --from=nodebuild /app/node_modules/@ngageoint/geopackage/dist/geopackage.min.js /var/www/html/public/geopackage.min.js
COPY --from=nodebuild /app/node_modules/@ngageoint/geopackage/dist/sql-wasm.wasm /var/www/html/public/sql-wasm.wasm

# Ensure writable dirs
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

# Startup script to run migrations on container start (for Render Free, no Pre-Deploy)
COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Expose 80 (default for Apache)
EXPOSE 80

# Default command: run migrations then start Apache
CMD ["start.sh"]
