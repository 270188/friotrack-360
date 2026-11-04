# MySQL 8 con el esquema de FrioTrack 360 precargado.
# Se construye desde la raíz del repositorio (el esquema vive en ./friotrack360.sql):
#   docker build -f db/Dockerfile -t friotrack-db .
# El script solo se ejecuta la primera vez, cuando el volumen /var/lib/mysql está vacío.
FROM mysql:8.0
COPY friotrack360.sql /docker-entrypoint-initdb.d/01-esquema.sql
EXPOSE 3306
